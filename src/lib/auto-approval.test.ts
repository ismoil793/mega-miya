/** @jest-environment node */
import { canApproveReview } from './auto-approval';

const base = {
  reviewStatus: 'completed', reviewedHeadSha: 'sha', currentHeadSha: 'sha', draft: false, state: 'open',
  findingCommentIds: [11, 22], threads: [{ rootCommentId: 11, isResolved: true }, { rootCommentId: 22, isResolved: true }],
};

describe('automatic approval policy', () => {
  it('approves only when every recorded finding is resolved for the reviewed head', () => {
    expect(canApproveReview(base)).toBe(true);
    expect(canApproveReview({ ...base, threads: [{ rootCommentId: 11, isResolved: true }, { rootCommentId: 22, isResolved: false }] })).toBe(false);
    expect(canApproveReview({ ...base, currentHeadSha: 'new-sha' })).toBe(false);
  });

  it('rejects drafts, non-open PRs, incomplete reviews, and missing recorded threads', () => {
    expect(canApproveReview({ ...base, draft: true })).toBe(false);
    expect(canApproveReview({ ...base, state: 'closed' })).toBe(false);
    expect(canApproveReview({ ...base, reviewStatus: 'pending' })).toBe(false);
    expect(canApproveReview({ ...base, threads: [] })).toBe(false);
    expect(canApproveReview({ ...base, findingCommentIds: [] })).toBe(true);
  });
});
