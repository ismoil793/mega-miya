/**
 * @jest-environment node
 *
 * Integration test for the review pipeline's GitHub-facing logic, with the LLM
 * and the GitHub API mocked. Verifies:
 *   - model findings are normalized into inline comments,
 *   - out-of-diff lines are snapped to a valid anchor,
 *   - below-`MIN_SEVERITY` findings are excluded from inline comments,
 *   - suggestions render as ```suggestion``` blocks,
 *   - the summary comment is upserted (PATCH) when one already exists.
 */
import { generateAICodeReview } from './ai-review';
import { postReview } from './github-review';

jest.mock('./llm', () => {
  const actual = jest.requireActual('./llm');
  return {
    ...actual,
    activeModelLabel: () => 'mock-model',
    callLLM: jest.fn(),
  };
});

const { callLLM } = require('./llm');

const PATCH = [
  '@@ -1,3 +1,7 @@',
  ' function getUser(users, id) {', // line 1
  '-  return users.find(u => u.id === id);',
  '+  const user = users.find(u => u.id == id);', // line 2
  '+  return user.name.toUpperCase();', // line 3
  ' }', // line 4
  '+', // line 5
  '+const x = 1;', // line 6
  '+const y = 2;', // line 7
].join('\n');

function mockModelResponse() {
  callLLM.mockResolvedValue(
    JSON.stringify({
      summary: 'Adds user helpers; found a null-safety bug.',
      score: 62,
      positiveAspects: ['Clear function name'],
      comments: [
        {
          file: 'src/user.js',
          line: 3,
          severity: 'high',
          category: 'bug',
          body: 'user may be undefined; calling .name throws.',
          suggestion: '  return user?.name?.toUpperCase();',
        },
        {
          // out-of-diff line -> should snap to nearest commentable line
          file: 'src/user.js',
          line: 999,
          severity: 'medium',
          category: 'maintainability',
          body: 'Prefer === over ==.',
        },
        {
          // below MIN_SEVERITY when floor is medium -> excluded from inline
          file: 'src/user.js',
          line: 6,
          severity: 'low',
          category: 'style',
          body: 'Consider a more descriptive name than x.',
        },
      ],
    }),
  );
}

async function buildReview() {
  return generateAICodeReview({
    repository: 'demo/repo',
    pullRequest: { title: 'Add user helpers', description: '', number: 7 },
    files: [{ filename: 'src/user.js', patch: PATCH, additions: 6, deletions: 1 }],
  });
}

describe('review pipeline (LLM + GitHub mocked)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.MIN_SEVERITY;
  });

  it('normalizes model output into structured comments + legacy shape', async () => {
    mockModelResponse();
    const review = await buildReview();

    expect(review.result.score).toBe(62);
    expect(review.result.comments).toHaveLength(3);
    // The high-severity bug becomes a dashboard "issue".
    expect(review.result.issues.some((i) => i.severity === 'high' && i.type === 'bug')).toBe(true);
    // The low-severity style note becomes a "suggestion".
    expect(review.result.suggestions.some((s) => s.severity === 'low')).toBe(true);
  });

  it('posts validated inline comments + upserts the summary', async () => {
    process.env.MIN_SEVERITY = 'medium'; // drops the low-severity style note
    mockModelResponse();
    const review = await buildReview();

    const calls: Array<{ url: string; method: string; body: any }> = [];
    const fetchMock = jest.fn(async (url: string, init: any = {}) => {
      calls.push({ url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : undefined });
      // existing review comments (none) and existing issue comments (one summary)
      if (url.includes('/pulls/7/comments')) return jsonResponse([]);
      if (url.includes('/issues/7/comments')) {
        return jsonResponse([{ id: 555, body: 'earlier\n<!-- mega-miyya-summary -->\nold' }]);
      }
      return jsonResponse({ ok: true });
    });
    (global as any).fetch = fetchMock;

    await postReview('demo/repo', 7, 'headsha123', review, 'tok');

    // 1) Inline review POST to the Reviews API.
    const reviewPost = calls.find((c) => c.url.endsWith('/pulls/7/reviews') && c.method === 'POST');
    expect(reviewPost).toBeDefined();
    const inline = reviewPost!.body.comments as any[];

    // Two eligible findings (high bug + medium maintainability); low was filtered out.
    expect(inline).toHaveLength(2);

    // The bug comment keeps line 3 and includes a suggestion block.
    const bug = inline.find((c) => c.body.includes('.name throws'));
    expect(bug.line).toBe(3);
    expect(bug.side).toBe('RIGHT');
    expect(bug.body).toContain('```suggestion');
    expect(bug.body).toContain('user?.name?.toUpperCase()');

    // The out-of-diff finding (line 999) was snapped to a real commentable line (<= 7).
    const snapped = inline.find((c) => c.body.includes('=== over =='));
    expect(snapped.line).toBeLessThanOrEqual(7);

    // 2) Summary was upserted via PATCH to the existing comment id 555.
    const patch = calls.find((c) => c.url.includes('/issues/comments/555') && c.method === 'PATCH');
    expect(patch).toBeDefined();
    expect(patch!.body.body).toContain('Overall score: 62/100');
    expect(patch!.body.body).toContain('<!-- mega-miyya-summary -->');
  });
});

function jsonResponse(data: any) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as any;
}
