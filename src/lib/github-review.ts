/**
 * Post a generated review back to GitHub, CodeRabbit-style:
 *
 *  - Line-anchored inline comments via the Reviews API, with applyable
 *    ```suggestion``` blocks where the model proposed a fix.
 *  - A single summary comment that is upserted (edited in place on re-review)
 *    rather than duplicated on every push.
 *
 * All GitHub line numbers are validated against the diff's commentable lines so
 * we never trigger a 422 for commenting outside the diff.
 */
import { snapToCommentableLine } from './diff';
import type { GeneratedReview } from './ai-review';
import type { ReviewComment, ReviewSeverity } from '@/types';

const GH = 'https://api.github.com';
const SUMMARY_MARKER = '<!-- mega-miya-summary -->';

const SEVERITY_RANK: Record<ReviewSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const SEVERITY_EMOJI: Record<ReviewSeverity, string> = { low: '🟦', medium: '🟨', high: '🟧', critical: '🟥' };

function minSeverityRank(): number {
  const raw = (process.env.MIN_SEVERITY || 'low').toLowerCase() as ReviewSeverity;
  return SEVERITY_RANK[raw] ?? 0;
}

interface GHHeaders {
  [k: string]: string;
}

function headers(token: string): GHHeaders {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

function commentBody(c: ReviewComment): string {
  const header = `${SEVERITY_EMOJI[c.severity]} **${c.severity.toUpperCase()} · ${c.category}**`;
  let body = `${header}\n\n${c.body}`;
  if (c.suggestion) {
    body += `\n\n\`\`\`suggestion\n${c.suggestion.replace(/\n$/, '')}\n\`\`\``;
  }
  return body;
}

async function fetchExistingReviewComments(
  repository: string,
  prNumber: number,
  token: string,
): Promise<Set<string>> {
  const seen = new Set<string>();
  try {
    const res = await fetch(`${GH}/repos/${repository}/pulls/${prNumber}/comments?per_page=100`, {
      headers: headers(token),
    });
    if (!res.ok) return seen;
    const comments = await res.json();
    for (const c of comments) {
      // Key on path+line+first line of body to avoid re-posting identical notes.
      seen.add(`${c.path}:${c.line ?? c.original_line}:${(c.body || '').split('\n\n')[1] || c.body}`);
    }
  } catch (err) {
    console.error('Could not fetch existing review comments (continuing):', err);
  }
  return seen;
}

interface InlinePayload {
  path: string;
  line: number;
  side: 'RIGHT';
  body: string;
}

/**
 * Post the review: inline comments (deduped, line-validated) + upserted summary.
 */
export async function postReview(
  repository: string,
  prNumber: number,
  commitSha: string,
  review: GeneratedReview,
  token: string,
): Promise<void> {
  const { result, diffs } = review;
  const minRank = minSeverityRank();

  const eligible = (result.comments || []).filter((c) => SEVERITY_RANK[c.severity] >= minRank);
  const existing = await fetchExistingReviewComments(repository, prNumber, token);

  const inline: InlinePayload[] = [];
  const unanchored: ReviewComment[] = [];

  for (const c of eligible) {
    const diff = diffs.get(c.file);
    if (!diff) {
      unanchored.push(c);
      continue;
    }
    const line = snapToCommentableLine(c.line, diff.commentableList);
    if (line === null) {
      unanchored.push(c);
      continue;
    }
    const dedupKey = `${c.file}:${line}:${c.body}`;
    if (existing.has(dedupKey)) continue;
    inline.push({ path: c.file, line, side: 'RIGHT', body: commentBody(c) });
  }

  await postInlineReview(repository, prNumber, commitSha, inline, token);
  await upsertSummary(repository, prNumber, result.summary, result.score, eligible, unanchored, token);
}

async function postInlineReview(
  repository: string,
  prNumber: number,
  commitSha: string,
  comments: InlinePayload[],
  token: string,
): Promise<void> {
  if (comments.length === 0) return;

  const res = await fetch(`${GH}/repos/${repository}/pulls/${prNumber}/reviews`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      commit_id: commitSha,
      event: 'COMMENT',
      comments,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`❌ Failed to post inline review (${res.status}): ${errText}`);
    // Fall back to posting comments individually so one bad anchor doesn't sink all.
    for (const c of comments) {
      await postSingleInlineComment(repository, prNumber, commitSha, c, token);
    }
  } else {
    console.log(`✅ Posted ${comments.length} inline comment(s) on PR #${prNumber}`);
  }
}

async function postSingleInlineComment(
  repository: string,
  prNumber: number,
  commitSha: string,
  c: InlinePayload,
  token: string,
): Promise<void> {
  try {
    const res = await fetch(`${GH}/repos/${repository}/pulls/${prNumber}/comments`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ commit_id: commitSha, path: c.path, line: c.line, side: c.side, body: c.body }),
    });
    if (!res.ok) {
      console.error(`  ↳ skipped comment on ${c.path}:${c.line} (${res.status})`);
    }
  } catch (err) {
    console.error(`  ↳ error posting comment on ${c.path}:${c.line}:`, err);
  }
}

function buildSummaryBody(
  summary: string,
  score: number,
  comments: ReviewComment[],
  unanchored: ReviewComment[],
): string {
  const scoreEmoji = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
  const counts = comments.reduce<Record<string, number>>((acc, c) => {
    acc[c.severity] = (acc[c.severity] || 0) + 1;
    return acc;
  }, {});

  let body = `${SUMMARY_MARKER}\n## 🤖 Mega Miya Code Review\n\n`;
  body += `${scoreEmoji} **Overall score: ${score}/100**\n\n`;
  body += `### Summary\n${summary}\n\n`;

  if (comments.length > 0) {
    const parts = (['critical', 'high', 'medium', 'low'] as ReviewSeverity[])
      .filter((s) => counts[s])
      .map((s) => `${SEVERITY_EMOJI[s]} ${counts[s]} ${s}`);
    body += `### Findings\n${comments.length} inline comment(s): ${parts.join(' · ')}\n\n`;
  } else {
    body += `### Findings\nNo blocking issues found in the changed lines. ✅\n\n`;
  }

  if (unanchored.length > 0) {
    body += `### Notes not tied to a diff line\n`;
    unanchored.forEach((c) => {
      body += `- ${SEVERITY_EMOJI[c.severity]} **${c.file}**: ${c.body.split('\n')[0]}\n`;
    });
    body += `\n`;
  }

  body += `---\n*🤖 Automated review by [Mega Miya](https://github.com/ismoil793/mega-miya) — verify suggestions before applying.*`;
  return body;
}

async function upsertSummary(
  repository: string,
  prNumber: number,
  summary: string,
  score: number,
  comments: ReviewComment[],
  unanchored: ReviewComment[],
  token: string,
): Promise<void> {
  const body = buildSummaryBody(summary, score, comments, unanchored);

  // Look for an existing summary comment to edit (avoids spamming on each push).
  let existingId: number | null = null;
  try {
    const res = await fetch(`${GH}/repos/${repository}/issues/${prNumber}/comments?per_page=100`, {
      headers: headers(token),
    });
    if (res.ok) {
      const comments = await res.json();
      const found = comments.find((c: any) => typeof c.body === 'string' && c.body.includes(SUMMARY_MARKER));
      if (found) existingId = found.id;
    }
  } catch (err) {
    console.error('Could not list issue comments for summary upsert (continuing):', err);
  }

  try {
    if (existingId) {
      const res = await fetch(`${GH}/repos/${repository}/issues/comments/${existingId}`, {
        method: 'PATCH',
        headers: headers(token),
        body: JSON.stringify({ body }),
      });
      if (!res.ok) console.error(`❌ Failed to update summary comment (${res.status}): ${await res.text()}`);
      else console.log(`✅ Updated summary comment on PR #${prNumber}`);
    } else {
      const res = await fetch(`${GH}/repos/${repository}/issues/${prNumber}/comments`, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify({ body }),
      });
      if (!res.ok) console.error(`❌ Failed to post summary comment (${res.status}): ${await res.text()}`);
      else console.log(`✅ Posted summary comment on PR #${prNumber}`);
    }
  } catch (err) {
    console.error('Error upserting summary comment:', err);
  }
}
