import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/database';
import { UserModel } from '@/models/User';
import { CodeReviewModel } from '@/models/CodeReview';
import { generateAICodeReview, ReviewFile } from '@/lib/ai-review';
import { postReview } from '@/lib/github-review';
import { githubAppService } from '@/lib/github-app';
import { GitHubInstallationModel } from '@/models/GitHubInstallation';
import crypto from 'crypto';
import { resolveAccountLLMConfig } from '@/lib/account-llm-config';
import { waitUntil } from '@vercel/functions';
import { attachFullFileContext, attachMissingPatchContext, type ContextManifest } from '@/lib/review-context';
import { discoverSupportingContext } from '@/lib/supporting-context';
import { processReviewThreadWebhook } from '@/lib/auto-approval';

// Give the managed background review enough time to call GitHub and the LLM.
export const maxDuration = 300;

/** When true, review every repo the app is installed on (no DB opt-in needed). */
function reviewAllRepos(): boolean {
  return String(process.env.REVIEW_ALL_REPOS || '').toLowerCase() === 'true';
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > 2_000_000) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    const body = await request.text();
    if (Buffer.byteLength(body, 'utf8') > 2_000_000) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    const signature = request.headers.get('x-hub-signature-256');

    if (!verifyWebhookSignature(body, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = request.headers.get('x-github-event');
    const payload = JSON.parse(body);

    console.log(`Received GitHub webhook: ${event} for ${payload.repository?.full_name}`);

    if (event === 'installation') {
      await processInstallationEvent(payload);
      return NextResponse.json({ message: 'Installation event processed' });
    }

    if (event === 'installation_repositories') {
      await processInstallationRepositoriesEvent(payload);
      return NextResponse.json({ message: 'Installation repositories event processed' });
    }

    if (event === 'pull_request_review_thread') {
      const repository = payload.repository?.full_name;
      if (!repository) return NextResponse.json({ message: 'Event ignored' });
      const token = await resolveInstallationToken(repository, payload.installation?.id);
      const result = await processReviewThreadWebhook(payload, token);
      return NextResponse.json({ message: `Review thread ${result}` });
    }

    if (event !== 'pull_request') {
      return NextResponse.json({ message: 'Event ignored' });
    }

    const action = payload.action;
    const repository = payload.repository.full_name;
    const pullRequest = payload.pull_request;
    const installationId = payload.installation?.id;

    if (!['opened', 'synchronize', 'reopened'].includes(action)) {
      return NextResponse.json({ message: 'Action ignored' });
    }

    // Decide whether this repo should be reviewed.
    if (!reviewAllRepos()) {
      const enabled = await isRepoEnabled(repository, installationId);
      if (!enabled) {
        console.log(`Repository ${repository} not enabled for AI reviews`);
        return NextResponse.json({ message: 'Repository not enabled' });
      }
    }

    // Best-effort review record (never block the review if the DB is unavailable).
    const reviewId = await createOrUpdateReviewRecord(payload);

    // Keep the serverless invocation alive after returning a prompt webhook response.
    waitUntil(processAICodeReview(reviewId, repository, pullRequest, installationId, payload.repository.id));

    return NextResponse.json({ message: 'Review triggered', reviewId });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function normalizeInstallationRepository(repository: any) {
  return {
    githubRepositoryId: repository.id,
    name: repository.name,
    fullName: repository.full_name,
    private: Boolean(repository.private),
  };
}

async function processInstallationEvent(payload: any): Promise<void> {
  await connectDB();
  const installation = payload.installation;
  if (!installation?.id || !installation.account?.id) {
    throw new Error('Installation payload is missing installation or account identity');
  }

  githubAppService.clearInstallationCache(installation.account.login);

  if (payload.action === 'deleted') {
    await GitHubInstallationModel.deleteOne({ installationId: installation.id });
    return;
  }

  const update: Record<string, any> = {
    installationId: installation.id,
    accountId: installation.account.id,
    accountLogin: installation.account.login,
    accountType: installation.account.type,
    status: payload.action === 'suspend' ? 'suspended' : 'active',
  };
  if (Array.isArray(payload.repositories)) {
    update.repositories = payload.repositories.map(normalizeInstallationRepository);
  }

  await GitHubInstallationModel.findOneAndUpdate(
    { installationId: installation.id },
    { $set: update },
    { upsert: true, new: true },
  );
}

async function processInstallationRepositoriesEvent(payload: any): Promise<void> {
  await connectDB();
  const installationId = payload.installation?.id;
  if (!installationId) throw new Error('Installation repositories payload is missing installation id');

  const added = Array.isArray(payload.repositories_added)
    ? payload.repositories_added.map(normalizeInstallationRepository)
    : [];
  const removedIds = Array.isArray(payload.repositories_removed)
    ? payload.repositories_removed.map((repository: any) => repository.id)
    : [];

  if (removedIds.length > 0) {
    await GitHubInstallationModel.updateOne(
      { installationId },
      { $pull: { repositories: { githubRepositoryId: { $in: removedIds } } } },
    );
  }
  for (const repository of added) {
    await GitHubInstallationModel.updateOne(
      { installationId, 'repositories.githubRepositoryId': { $ne: repository.githubRepositoryId } },
      { $push: { repositories: repository } },
    );
  }
}

/** Check the DB opt-in list. Returns false (not fatal) if the DB is unreachable. */
async function isRepoEnabled(repository: string, installationId?: number): Promise<boolean> {
  try {
    await connectDB();
    if (!installationId) return false;
    const installation = await GitHubInstallationModel.exists({
      installationId,
      status: 'active',
      'repositories.fullName': repository,
    });
    if (!installation) return false;
    const user = await UserModel.findOne({ repositories: repository });
    return !!user;
  } catch (err) {
    console.error('DB check failed while resolving repo opt-in:', err);
    return false;
  }
}

async function createOrUpdateReviewRecord(payload: any): Promise<string | null> {
  try {
    await connectDB();
    const repository = payload.repository.full_name;
    const pullRequest = payload.pull_request;

    const existing = await CodeReviewModel.findOne({
      repositoryId: payload.repository.id,
      pullRequestId: pullRequest.id,
    });

    if (existing) {
      await CodeReviewModel.findByIdAndUpdate(existing._id, {
        $set: {
          status: 'pending',
          pullRequestNumber: pullRequest.number,
          reviewedHeadSha: pullRequest.head.sha,
          findingCommentIds: [],
          findingTrackingComplete: false,
          updatedAt: new Date(),
        },
        $unset: { approvalHeadSha: 1, approvalReviewId: 1, approvedAt: 1 },
      });
      return existing._id.toString();
    }

    const review = new CodeReviewModel({
      repositoryId: payload.repository.id,
      pullRequestId: pullRequest.id,
      pullRequestNumber: pullRequest.number,
      repositoryName: repository,
      status: 'pending',
      reviewedHeadSha: pullRequest.head.sha,
    });
    await review.save();
    return review._id.toString();
  } catch (err) {
    console.error('Could not persist review record (continuing without DB):', err);
    return null;
  }
}

async function processAICodeReview(
  reviewId: string | null,
  repository: string,
  pullRequest: any,
  installationId: number | undefined,
  repositoryId: number,
) {
  try {
    const startedAt = Date.now();
    console.log(`Starting AI review for PR #${pullRequest.number} in ${repository}`);

    const installationToken = await resolveInstallationToken(repository, installationId);
    const llmConfig = await resolveAccountLLMConfig(installationId);
    const installation: any = installationId
      ? await GitHubInstallationModel.findOne({ installationId }).select('reviewSettings').lean()
      : null;
    const contextDepth = installation?.reviewSettings?.contextDepth;

    // Fetch the PR's changed files (includes the unified-diff patch per file).
    const files = await fetchAllPullRequestFiles(repository, pullRequest.number, installationToken);

    const reviewFiles: ReviewFile[] = files.map((f: any) => ({
      filename: f.filename,
      patch: f.patch,
      additions: f.additions,
      deletions: f.deletions,
      status: f.status,
    }));

    // Context is fetched at the immutable PR head SHA and kept in memory only.
    // Any per-file failure safely falls back to the existing diff-only review.
    const context = await attachFullFileContext({
      repository,
      headSha: pullRequest.head.sha,
      token: installationToken,
      files: reviewFiles,
      enabled: contextDepth ? contextDepth !== 'diff' : undefined,
    });
    await attachMissingPatchContext({
      repository,
      baseSha: pullRequest.base?.sha,
      token: installationToken,
      files: context.files,
      enabled: context.manifest.enabled,
    });
    const supporting = await discoverSupportingContext({
      repository,
      headSha: pullRequest.head.sha,
      token: installationToken,
      changedFiles: context.files,
      enabled: contextDepth ? contextDepth === 'balanced' || contextDepth === 'deep' : undefined,
      depth: contextDepth,
    });
    context.manifest.files.push(...supporting.manifest);
    context.manifest.totalCharacters += supporting.manifest.reduce((sum, file) => sum + file.characters, 0);

    const review = await generateAICodeReview({
      repository,
      pullRequest: {
        title: pullRequest.title,
        description: pullRequest.body,
        number: pullRequest.number,
      },
      files: context.files,
      contextManifest: context.manifest,
      supportingContext: supporting.files,
    }, llmConfig);

    const posted = await postReview(repository, pullRequest.number, pullRequest.head.sha, review, installationToken);
    await updateReviewStatus(reviewId, 'completed', review.result, review.model, review.contextManifest, {
      githubReviewId: posted.githubReviewId,
      findingCommentIds: posted.findingCommentIds,
      findingTrackingComplete: posted.trackingComplete,
      reviewedHeadSha: pullRequest.head.sha,
    }, {
      totalFiles: reviewFiles.length,
      totalLines: reviewFiles.reduce((sum, file) => sum + file.additions + file.deletions, 0),
      languages: Array.from(new Set(reviewFiles.map((file) => file.filename.split('.').pop() || 'unknown'))),
      processingTime: Date.now() - startedAt,
      tokensUsed: review.usage.estimatedTokens,
      provider: review.usage.provider,
      promptCharacters: review.usage.promptCharacters,
      responseCharacters: review.usage.responseCharacters,
      contextDepth: contextDepth || (context.manifest.enabled ? 'changed-files' : 'diff'),
    });

    // Also evaluates a clean review (zero findings), for which no thread-resolved webhook will arrive.
    if (posted.trackingComplete) {
      await processReviewThreadWebhook({
        action: 'resolved',
        installation: { id: installationId },
        repository: { id: repositoryId, full_name: repository },
        pull_request: { id: pullRequest.id, number: pullRequest.number },
      }, installationToken);
    }

    console.log(`AI review completed for PR #${pullRequest.number} in ${repository}`);
  } catch (error) {
    console.error(`AI review PR#${pullRequest.number}:`, error);
    console.log(`AI review PR#${pullRequest.number}:`, error);
    await updateReviewStatus(reviewId, 'failed', {
      summary: 'Review failed due to an error',
      score: 0,
      suggestions: [],
      issues: [],
      positiveAspects: [],
      comments: [],
    });
  }
}

/** Resolve an installation token, preferring the webhook's installation id. */
async function resolveInstallationToken(repository: string, installationId?: number): Promise<string> {
  if (installationId) {
    try {
      const jwt = githubAppService.generateJWT();
      const res = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github.v3+json' },
      });
      if (res.ok) {
        const data = await res.json();
        return data.token;
      }
      throw new Error(`installation token request failed: ${res.status}`);
    } catch (err) {
      console.error('Falling back to dynamic installation lookup:', err);
    }
  }
  const [owner, repo] = repository.split('/');
  return githubAppService.getInstallationTokenForRepo(owner, repo);
}

/** Fetch all changed files across pagination (GitHub caps at 3000 files / 100 per page). */
async function fetchAllPullRequestFiles(repository: string, prNumber: number, token: string): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= 30; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${repository}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } },
    );
    if (!res.ok) throw new Error(`Failed to fetch PR files: ${res.status} ${res.statusText}`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

async function updateReviewStatus(
  reviewId: string | null,
  status: string,
  reviewData?: any,
  model?: string,
  contextManifest?: ContextManifest,
  reviewState?: { githubReviewId?: number; findingCommentIds?: number[]; findingTrackingComplete?: boolean; reviewedHeadSha?: string },
  metrics?: { totalFiles: number; totalLines: number; languages: string[]; processingTime: number; tokensUsed: number; provider: string; promptCharacters: number; responseCharacters: number; contextDepth: string },
) {
  if (!reviewId) return;
  try {
    await connectDB();
    await CodeReviewModel.findByIdAndUpdate(reviewId, {
      status,
      review: reviewData,
      ...(model ? { 'metadata.aiModel': model } : {}),
      ...(contextManifest ? {
        'metadata.contextFiles': contextManifest.files,
        'metadata.contextFileCount': contextManifest.files.length,
        'metadata.contextCharacters': contextManifest.totalCharacters,
        'metadata.contextTruncatedFileCount': contextManifest.files.filter((file) => file.truncated).length,
      } : {}),
      ...(reviewState || {}),
      ...(metrics ? {
        'metadata.totalFiles': metrics.totalFiles,
        'metadata.totalLines': metrics.totalLines,
        'metadata.languages': metrics.languages,
        'metadata.processingTime': metrics.processingTime,
        'metadata.tokensUsed': metrics.tokensUsed,
        'metadata.tokensEstimated': true,
        'metadata.aiProvider': metrics.provider,
        'metadata.promptCharacters': metrics.promptCharacters,
        'metadata.responseCharacters': metrics.responseCharacters,
        'metadata.contextDepth': metrics.contextDepth,
      } : {}),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to update review status:', error);
  }
}

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('GITHUB_WEBHOOK_SECRET is required in production.');
    return false;
  }

  if (!secret) {
    console.warn(
      '⚠️  GITHUB_WEBHOOK_SECRET is not set — webhook signatures are NOT being verified. Set it in production.',
    );
    return true;
  }

  if (!signature) {
    console.error('Missing x-hub-signature-256 header while a webhook secret is configured.');
    return false;
  }

  const expected = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}
