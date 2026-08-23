import { connectDB } from './database';
import { CodeReviewModel } from '@/models/CodeReview';
import { GitHubInstallationModel } from '@/models/GitHubInstallation';

interface ThreadState { rootCommentId: number; isResolved: boolean }

export function canApproveReview(args: {
  reviewStatus: string;
  reviewedHeadSha?: string;
  currentHeadSha: string;
  draft: boolean;
  state: string;
  findingCommentIds: number[];
  threads: ThreadState[];
}): boolean {
  if (args.reviewStatus !== 'completed' || args.draft || args.state !== 'open') return false;
  if (!args.reviewedHeadSha || args.reviewedHeadSha !== args.currentHeadSha) return false;
  if (args.findingCommentIds.length === 0) return true;
  const stateByComment = new Map(args.threads.map((thread) => [thread.rootCommentId, thread.isResolved]));
  return args.findingCommentIds.every((id) => stateByComment.get(id) === true);
}

async function loadThreads(repository: string, prNumber: number, token: string): Promise<ThreadState[]> {
  const [owner, name] = repository.split('/');
  const threads: ThreadState[] = [];
  let cursor: string | null = null;
  do {
    const response: Response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$cursor){nodes{isResolved comments(first:1){nodes{databaseId}}}pageInfo{hasNextPage endCursor}}}}}`,
        variables: { owner, name, number: prNumber, cursor },
      }),
    });
    if (!response.ok) throw new Error(`Failed to query review threads: ${response.status}`);
    const data: any = await response.json();
    if (data.errors) throw new Error('GitHub GraphQL rejected the review-thread query');
    const connection: any = data.data?.repository?.pullRequest?.reviewThreads;
    for (const thread of connection?.nodes || []) {
      const id = thread.comments?.nodes?.[0]?.databaseId;
      if (Number.isSafeInteger(id)) threads.push({ rootCommentId: id, isResolved: Boolean(thread.isResolved) });
    }
    cursor = connection?.pageInfo?.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (cursor);
  return threads;
}

async function githubRequest(url: string, token: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', ...init.headers },
  });
}

export async function processReviewThreadWebhook(payload: any, token: string): Promise<'ignored' | 'approved' | 'not-ready' | 'dismissed'> {
  const installationId = payload.installation?.id;
  const repository = payload.repository?.full_name;
  const pullRequest = payload.pull_request;
  if (!installationId || !repository || !pullRequest?.number || !['resolved', 'unresolved'].includes(payload.action)) return 'ignored';
  await connectDB();
  const installation: any = await GitHubInstallationModel.findOne({ installationId, status: 'active' }).lean();
  if (!installation?.reviewSettings?.autoApproveWhenResolved) return 'ignored';
  const review = await CodeReviewModel.findOne({ repositoryId: payload.repository.id, pullRequestId: pullRequest.id });
  if (!review) return 'ignored';
  if (!review.findingTrackingComplete) return 'not-ready';

  const threads = await loadThreads(repository, pullRequest.number, token);
  const recordedIds = new Set<number>(review.findingCommentIds || []);
  const recordedThreads = threads.filter((thread) => recordedIds.has(thread.rootCommentId));
  await CodeReviewModel.updateOne({ _id: review._id }, { $set: {
    'metadata.resolvedFindingCount': recordedThreads.filter((thread) => thread.isResolved).length,
    'metadata.unresolvedFindingCount': recordedThreads.filter((thread) => !thread.isResolved).length,
  } });

  if (payload.action === 'unresolved') {
    if (!review.approvalReviewId) return 'not-ready';
    const response = await githubRequest(
      `https://api.github.com/repos/${repository}/pulls/${pullRequest.number}/reviews/${review.approvalReviewId}/dismissals`,
      token,
      { method: 'PUT', body: JSON.stringify({ message: 'A Mega-Miya review thread was reopened.' }) },
    );
    if (!response.ok) return 'not-ready';
    review.approvalHeadSha = undefined;
    review.approvalReviewId = undefined;
    review.approvedAt = undefined;
    await review.save();
    return 'dismissed';
  }

  const prResponse = await githubRequest(`https://api.github.com/repos/${repository}/pulls/${pullRequest.number}`, token);
  if (!prResponse.ok) return 'not-ready';
  const current = await prResponse.json();
  if (!canApproveReview({
    reviewStatus: review.status,
    reviewedHeadSha: review.reviewedHeadSha,
    currentHeadSha: current.head?.sha,
    draft: Boolean(current.draft),
    state: current.state,
    findingCommentIds: review.findingCommentIds || [],
    threads,
  })) return 'not-ready';

  const claimed = await CodeReviewModel.findOneAndUpdate(
    { _id: review._id, approvalHeadSha: { $ne: current.head.sha }, status: 'completed', reviewedHeadSha: current.head.sha },
    { $set: { approvalHeadSha: current.head.sha } },
    { new: true },
  );
  if (!claimed) return 'not-ready';
  const approval = await githubRequest(`https://api.github.com/repos/${repository}/pulls/${pullRequest.number}/reviews`, token, {
    method: 'POST',
    body: JSON.stringify({ commit_id: current.head.sha, event: 'APPROVE', body: 'All active Mega-Miya review threads for this commit have been resolved.' }),
  });
  if (!approval.ok) {
    await CodeReviewModel.updateOne({ _id: review._id, approvalHeadSha: current.head.sha }, { $unset: { approvalHeadSha: 1 } });
    return 'not-ready';
  }
  const created = await approval.json();
  await CodeReviewModel.updateOne({ _id: review._id }, { $set: { approvalReviewId: created.id, approvedAt: new Date() } });
  return 'approved';
}
