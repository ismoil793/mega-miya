import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/database';
import { UserModel } from '@/models/User';
import { CodeReviewModel } from '@/models/CodeReview';
import { generateAICodeReview, ReviewFile } from '@/lib/ai-review';
import { postReview } from '@/lib/github-review';
import { githubAppService } from '@/lib/github-app';

/** When true, review every repo the app is installed on (no DB opt-in needed). */
function reviewAllRepos(): boolean {
  return String(process.env.REVIEW_ALL_REPOS || '').toLowerCase() === 'true';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    if (!verifyWebhookSignature(body, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = request.headers.get('x-github-event');
    const payload = JSON.parse(body);

    console.log(`Received GitHub webhook: ${event} for ${payload.repository?.full_name}`);

    // Handle installation events (app installed/uninstalled)
    if (event === 'installation') {
      if (payload.action === 'deleted') {
        const repositories = payload.repositories || [];
        for (const repo of repositories) {
          const [owner] = repo.full_name.split('/');
          githubAppService.clearInstallationCache(owner);
        }
        console.log(`🗑️ Cleared installation cache for installation ${payload.installation?.id}`);
      }
      return NextResponse.json({ message: 'Installation event processed' });
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
      const enabled = await isRepoEnabled(repository);
      if (!enabled) {
        console.log(`Repository ${repository} not enabled for AI reviews`);
        return NextResponse.json({ message: 'Repository not enabled' });
      }
    }

    // Best-effort review record (never block the review if the DB is unavailable).
    const reviewId = await createOrUpdateReviewRecord(payload, action);

    // Kick off the review without blocking the webhook response.
    processAICodeReview(reviewId, repository, pullRequest, installationId).catch((err) =>
      console.error('Unhandled error in processAICodeReview:', err),
    );

    return NextResponse.json({ message: 'Review triggered', reviewId });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Check the DB opt-in list. Returns false (not fatal) if the DB is unreachable. */
async function isRepoEnabled(repository: string): Promise<boolean> {
  try {
    await connectDB();
    const user = await UserModel.findOne({ repositories: repository });
    return !!user;
  } catch (err) {
    console.error('DB check failed while resolving repo opt-in:', err);
    return false;
  }
}

async function createOrUpdateReviewRecord(payload: any, action: string): Promise<string | null> {
  try {
    await connectDB();
    const repository = payload.repository.full_name;
    const pullRequest = payload.pull_request;

    const existing = await CodeReviewModel.findOne({
      repositoryId: payload.repository.id,
      pullRequestId: pullRequest.id,
    });

    if (existing) {
      await CodeReviewModel.findByIdAndUpdate(existing._id, { status: 'pending', updatedAt: new Date() });
      return existing._id.toString();
    }

    const review = new CodeReviewModel({
      repositoryId: payload.repository.id,
      pullRequestId: pullRequest.id,
      repositoryName: repository,
      status: 'pending',
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
) {
  try {
    console.log(`Starting AI review for PR #${pullRequest.number} in ${repository}`);

    const installationToken = await resolveInstallationToken(repository, installationId);

    // Fetch the PR's changed files (includes the unified-diff patch per file).
    const files = await fetchAllPullRequestFiles(repository, pullRequest.number, installationToken);

    const reviewFiles: ReviewFile[] = files.map((f: any) => ({
      filename: f.filename,
      patch: f.patch,
      additions: f.additions,
      deletions: f.deletions,
      status: f.status,
    }));

    const review = await generateAICodeReview({
      repository,
      pullRequest: {
        title: pullRequest.title,
        description: pullRequest.body,
        number: pullRequest.number,
      },
      files: reviewFiles,
    });

    await updateReviewStatus(reviewId, 'completed', review.result, review.model);

    await postReview(repository, pullRequest.number, pullRequest.head.sha, review, installationToken);

    console.log(`AI review completed for PR #${pullRequest.number} in ${repository}`);
  } catch (error) {
    console.error(`AI review failed for PR #${pullRequest.number}:`, error);
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

async function updateReviewStatus(reviewId: string | null, status: string, reviewData?: any, model?: string) {
  if (!reviewId) return;
  try {
    await connectDB();
    await CodeReviewModel.findByIdAndUpdate(reviewId, {
      status,
      review: reviewData,
      ...(model ? { 'metadata.aiModel': model } : {}),
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to update review status:', error);
  }
}

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

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

  const crypto = require('crypto');
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}
