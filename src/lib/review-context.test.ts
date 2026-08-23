/** @jest-environment node */
import { attachFullFileContext, attachMissingPatchContext, isExcludedContextPath } from './review-context';
import type { ReviewFile } from './ai-review';

const originalEnv = process.env;

function githubFile(content: string | Buffer) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return {
    ok: true,
    status: 200,
    json: async () => ({ type: 'file', encoding: 'base64', content: buffer.toString('base64') }),
  } as Response;
}

describe('full changed-file context', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    process.env = { ...originalEnv, REVIEW_INCLUDE_FULL_FILES: 'true' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects secrets, generated paths, and traversal before fetching', async () => {
    expect(isExcludedContextPath('.env')).toBe(true);
    expect(isExcludedContextPath('config/.env.production')).toBe(true);
    expect(isExcludedContextPath('private/server.pem')).toBe(true);
    expect(isExcludedContextPath('dist/app.js')).toBe(true);
    expect(isExcludedContextPath('../outside.ts')).toBe(true);
    expect(isExcludedContextPath('src/app.ts')).toBe(false);

    const fetchMock = jest.fn().mockResolvedValue(githubFile('safe'));
    global.fetch = fetchMock;
    const result = await attachFullFileContext({
      repository: 'acme/widget', headSha: 'immutable-sha', token: 'token',
      files: [
        { filename: '.env', patch: '@@ -0,0 +1 @@\n+SECRET=x', additions: 1, deletions: 0 },
        { filename: 'src/app.ts', patch: '@@ -0,0 +1 @@\n+safe', additions: 1, deletions: 0 },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/contents/src/app.ts?ref=immutable-sha');
    expect(result.manifest.skipped).toContainEqual({ filename: '.env', reason: 'excluded' });
  });

  it('truncates at per-file and total limits and records content-free metadata', async () => {
    process.env.REVIEW_MAX_FULL_FILE_CHARS = '10';
    process.env.REVIEW_MAX_TOTAL_CONTEXT_CHARS = '14';
    global.fetch = jest.fn()
      .mockResolvedValueOnce(githubFile('123456789012345'))
      .mockResolvedValueOnce(githubFile('abcdefghij'));

    const result = await attachFullFileContext({
      repository: 'acme/widget', headSha: 'sha', token: 'token',
      files: [
        { filename: 'a.ts', patch: 'patch', additions: 1, deletions: 0 },
        { filename: 'b.ts', patch: 'patch', additions: 1, deletions: 0 },
      ],
    });

    expect(result.files[0].fullContent).toBe('1234567890');
    expect(result.files[1].fullContent).toBe('abcd');
    expect(result.manifest.totalCharacters).toBe(14);
    expect(JSON.stringify(result.manifest)).not.toContain('1234567890');
    expect(result.manifest.files.every((file) => file.truncated)).toBe(true);
  });

  it('skips binary and failed files while retaining successful context', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(githubFile(Buffer.from([0, 1, 2])))
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce(githubFile('export const good = true;'));

    const result = await attachFullFileContext({
      repository: 'acme/widget', headSha: 'sha', token: 'token',
      files: ['image.dat', 'missing.ts', 'good.ts'].map((filename) => ({ filename, additions: 1, deletions: 0 })),
    });

    expect(result.files[0].fullContent).toBeUndefined();
    expect(result.files[1].fullContent).toBeUndefined();
    expect(result.files[2].fullContent).toContain('good');
    expect(result.manifest.skipped).toEqual(expect.arrayContaining([
      { filename: 'image.dat', reason: 'binary' },
      { filename: 'missing.ts', reason: 'fetch-failed' },
    ]));
  });

  it('makes no GitHub requests when the feature is disabled', async () => {
    process.env.REVIEW_INCLUDE_FULL_FILES = 'false';
    global.fetch = jest.fn();
    const result = await attachFullFileContext({
      repository: 'acme/widget', headSha: 'sha', token: 'token',
      files: [{ filename: 'app.ts', patch: 'patch', additions: 1, deletions: 0 }],
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.manifest.enabled).toBe(false);
  });

  it('adds a bounded base/head reasoning view when GitHub omits a patch', async () => {
    global.fetch = jest.fn().mockResolvedValue(githubFile('const value = "base";'));
    const files: ReviewFile[] = [{ filename: 'large.ts', additions: 10, deletions: 10, fullContent: 'const value = "head";' }];
    await attachMissingPatchContext({ repository: 'acme/widget', baseSha: 'base-sha', token: 'token', files, enabled: true });
    expect(files[0].reasoningPatch).toContain('--- BASE');
    expect(files[0].reasoningPatch).toContain('--- HEAD');
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain('ref=base-sha');
  });
});
