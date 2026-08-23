/**
 * Unified-diff parsing helpers.
 *
 * GitHub's PR "files" API returns a `patch` for each changed text file. To post
 * inline review comments we need two things derived from that patch:
 *
 *  1. An "annotated" version of the diff where every context/added line is
 *     prefixed with its real new-file line number, so the LLM can reference the
 *     exact line it is commenting on.
 *  2. The set of new-file line numbers that GitHub will actually accept as
 *     review-comment anchors (RIGHT side = added + context lines). Commenting on
 *     a line outside the diff hunks is rejected by GitHub with a 422.
 */

export interface ParsedFileDiff {
  /** The diff with `<newLineNo>` prefixes on each RIGHT-side line. */
  annotatedDiff: string;
  /** New-file line numbers that are valid anchors for a RIGHT-side comment. */
  commentableLines: Set<number>;
  /** Sorted array form of `commentableLines`, handy for snapping. */
  commentableList: number[];
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Parse a single file's unified-diff patch.
 *
 * Walks each `@@ -a,b +c,d @@` hunk, tracking the new-file line counter which
 * starts at `c`. Context (` `) and added (`+`) lines advance the counter and are
 * commentable on the RIGHT side; removed (`-`) lines belong to the old file and
 * are not RIGHT-side anchors. Anything before the first hunk header (or a patch
 * that is empty/undefined, e.g. binary or too-large files) yields no anchors.
 */
export function parseFileDiff(patch: string | undefined | null): ParsedFileDiff {
  const commentableLines = new Set<number>();

  if (!patch) {
    return { annotatedDiff: '', commentableLines, commentableList: [] };
  }

  const outLines: string[] = [];
  let newLine = 0;
  let inHunk = false;

  for (const line of patch.split('\n')) {
    const header = line.match(HUNK_HEADER);
    if (header) {
      inHunk = true;
      newLine = parseInt(header[1], 10);
      outLines.push(line);
      continue;
    }

    if (!inHunk) {
      // "\ No newline at end of file" markers or preamble — pass through.
      outLines.push(line);
      continue;
    }

    const marker = line[0];
    if (marker === '+') {
      commentableLines.add(newLine);
      outLines.push(`${newLine}\t${line}`);
      newLine++;
    } else if (marker === '-') {
      // Removed line: exists only in the old file, no RIGHT-side anchor.
      outLines.push(`\t${line}`);
    } else if (marker === '\\') {
      // "\ No newline at end of file" — not a real line.
      outLines.push(`\t${line}`);
    } else {
      // Context line (leading space, or an empty trailing line in the patch).
      commentableLines.add(newLine);
      outLines.push(`${newLine}\t${line}`);
      newLine++;
    }
  }

  const commentableList = Array.from(commentableLines).sort((a, b) => a - b);
  return { annotatedDiff: outLines.join('\n'), commentableLines, commentableList };
}

/**
 * Given a desired line and the commentable lines for a file, return the line to
 * actually anchor on: the line itself if valid, otherwise the nearest
 * commentable line, or `null` if the file has no anchors at all.
 */
export function snapToCommentableLine(
  desired: number,
  commentableList: number[],
): number | null {
  if (commentableList.length === 0) return null;
  if (commentableList.includes(desired)) return desired;

  let best = commentableList[0];
  let bestDist = Math.abs(best - desired);
  for (const line of commentableList) {
    const dist = Math.abs(line - desired);
    if (dist < bestDist) {
      best = line;
      bestDist = dist;
    }
  }
  return best;
}
