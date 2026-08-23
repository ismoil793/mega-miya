import { parseFileDiff, snapToCommentableLine } from './diff';

describe('parseFileDiff', () => {
  it('returns no anchors for an empty/undefined patch (binary or too-large file)', () => {
    expect(parseFileDiff(undefined).commentableLines.size).toBe(0);
    expect(parseFileDiff('').commentableLines.size).toBe(0);
    expect(parseFileDiff(null).annotatedDiff).toBe('');
  });

  it('numbers added and context lines by new-file position, skipping removed lines', () => {
    const patch = [
      '@@ -1,3 +1,4 @@',
      ' const a = 1;', // context -> line 1
      '-const b = 2;', // removed  -> no anchor
      '+const b = 20;', // added   -> line 2
      '+const c = 30;', // added   -> line 3
      ' return a;', // context -> line 4
    ].join('\n');

    const { commentableList } = parseFileDiff(patch);
    expect(commentableList).toEqual([1, 2, 3, 4]);
  });

  it('starts numbering from the hunk header new-start and handles multiple hunks', () => {
    const patch = [
      '@@ -10,2 +10,3 @@',
      ' x', // line 10
      '+y', // line 11
      ' z', // line 12
      '@@ -40,1 +41,2 @@',
      '+alpha', // line 41
      ' beta', // line 42
    ].join('\n');

    const { commentableList } = parseFileDiff(patch);
    expect(commentableList).toEqual([10, 11, 12, 41, 42]);
  });

  it('handles an added-only (new) file', () => {
    const patch = ['@@ -0,0 +1,3 @@', '+line one', '+line two', '+line three'].join('\n');
    expect(parseFileDiff(patch).commentableList).toEqual([1, 2, 3]);
  });

  it('does not treat the "\\ No newline at end of file" marker as a line', () => {
    const patch = ['@@ -1,1 +1,1 @@', '-old', '+new', '\\ No newline at end of file'].join('\n');
    expect(parseFileDiff(patch).commentableList).toEqual([1]);
  });

  it('prefixes each RIGHT-side line with its new-file line number', () => {
    const patch = ['@@ -1,1 +1,2 @@', ' keep', '+added'].join('\n');
    const { annotatedDiff } = parseFileDiff(patch);
    expect(annotatedDiff).toContain('1\t keep');
    expect(annotatedDiff).toContain('2\t+added');
  });
});

describe('snapToCommentableLine', () => {
  it('returns the line itself when it is commentable', () => {
    expect(snapToCommentableLine(5, [1, 5, 9])).toBe(5);
  });

  it('snaps to the nearest commentable line', () => {
    expect(snapToCommentableLine(6, [1, 5, 9])).toBe(5);
    expect(snapToCommentableLine(8, [1, 5, 9])).toBe(9);
  });

  it('returns null when there are no commentable lines', () => {
    expect(snapToCommentableLine(3, [])).toBeNull();
  });
});
