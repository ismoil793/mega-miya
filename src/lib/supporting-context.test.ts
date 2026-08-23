/** @jest-environment node */
import { discoverSupportingContext, extractImportSpecifiers, redactLikelySecrets } from './supporting-context';

function response(data: unknown) {
  return { ok: true, status: 200, json: async () => data } as Response;
}

describe('supporting context', () => {
  beforeEach(() => {
    process.env.REVIEW_INCLUDE_SUPPORTING_CONTEXT = 'true';
    delete process.env.REVIEW_EXCLUDE_GLOBS;
  });

  it('extracts common JavaScript and Python imports', () => {
    expect(extractImportSpecifiers('src/a.ts', "import x from './x'; const y = require('../y')"))
      .toEqual(expect.arrayContaining(['./x', '../y']));
    expect(extractImportSpecifiers('pkg/a.py', 'from .models import User\nimport os'))
      .toEqual(expect.arrayContaining(['.models', 'os']));
  });

  it('redacts likely credentials without storing their value', () => {
    const secret = `sk-${'a'.repeat(30)}`;
    expect(redactLikelySecrets(`api_key=${secret}`)).toBe('api_key=[REDACTED_SECRET]');
  });

  it('selects relative imports, tests, and config from the immutable tree', async () => {
    const tree = ['src/dep.ts', 'src/main.test.ts', 'package.json']
      .map((entryPath) => ({ type: 'blob', path: entryPath }));
    global.fetch = jest.fn(async (url: string) => {
      if (url.includes('/git/trees/')) return response({ tree });
      const content = url.includes('dep.ts') ? 'export const dep = true;' : url.includes('test') ? 'test("x", () => {})' : '{}';
      return response({ type: 'file', encoding: 'base64', content: Buffer.from(content).toString('base64') });
    }) as jest.Mock;
    const result = await discoverSupportingContext({
      repository: 'acme/repo', headSha: 'sha', token: 'token',
      changedFiles: [{ filename: 'src/main.ts', additions: 1, deletions: 0, fullContent: "import { dep } from './dep';" }],
    });
    expect(result.files.map((file) => [file.filename, file.reason])).toEqual(expect.arrayContaining([
      ['src/dep.ts', 'import'], ['src/main.test.ts', 'test'], ['package.json', 'config'],
    ]));
  });
});
