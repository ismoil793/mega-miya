import path from 'path';
import { fetchRepositoryText, isExcludedContextPath, redactLikelySecrets, type ContextManifestEntry } from './review-context';
import type { ReviewFile } from './ai-review';

export type ContextReason = 'import' | 'symbol' | 'test' | 'schema' | 'config' | 'caller';

export interface SupportingContext {
  filename: string;
  reason: ContextReason;
  content: string;
  truncated: boolean;
}

export interface SupportingContextResult {
  files: SupportingContext[];
  manifest: ContextManifestEntry[];
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.java', '.rb'];
const CONFIG_NAMES = new Set(['package.json', 'tsconfig.json', 'jsconfig.json', 'pyproject.toml', 'go.mod', 'pom.xml', 'build.gradle']);

function enabled(): boolean {
  return String(process.env.REVIEW_INCLUDE_SUPPORTING_CONTEXT || '').toLowerCase() === 'true';
}

function integer(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export { redactLikelySecrets } from './review-context';

export function extractImportSpecifiers(filename: string, content: string): string[] {
  const extension = path.posix.extname(filename).toLowerCase();
  const found = new Set<string>();
  const patterns = extension === '.py'
    ? [/^\s*from\s+([.\w]+)\s+import\s+/gm, /^\s*import\s+([.\w]+)/gm]
    : extension === '.go'
      ? [/^\s*import\s+(?:\w+\s+)?["`]([^"`]+)["`]/gm, /["`]([^"`]+)["`]/g]
      : [/(?:import|export)\s+(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g, /require\(\s*["']([^"']+)["']\s*\)/g];
  for (const regex of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content))) found.add(match[1]);
  }
  return Array.from(found);
}

function resolveImport(changedPath: string, specifier: string, tree: Set<string>): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(changedPath), specifier));
  if (base.startsWith('../') || base === '..') return null;
  const candidates = [base, ...SOURCE_EXTENSIONS.map((ext) => `${base}${ext}`), ...SOURCE_EXTENSIONS.map((ext) => `${base}/index${ext}`)];
  return candidates.find((candidate) => tree.has(candidate)) || null;
}

function testCandidates(filename: string, tree: Set<string>): string[] {
  const ext = path.posix.extname(filename);
  const stem = filename.slice(0, -ext.length);
  const base = path.posix.basename(stem);
  const dir = path.posix.dirname(filename);
  const candidates = [`${stem}.test${ext}`, `${stem}.spec${ext}`, `${dir}/__tests__/${base}${ext}`];
  return candidates.filter((candidate) => tree.has(candidate));
}

async function fetchTree(repository: string, sha: string, token: string): Promise<Set<string>> {
  const response = await fetch(`https://api.github.com/repos/${repository}/git/trees/${encodeURIComponent(sha)}?recursive=1`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) return new Set();
  const data = await response.json();
  return new Set<string>((Array.isArray(data.tree) ? data.tree : [])
    .filter((entry: any) => entry?.type === 'blob' && typeof entry.path === 'string')
    .map((entry: any) => entry.path));
}

export async function discoverSupportingContext(args: {
  repository: string;
  headSha: string;
  token: string;
  changedFiles: ReviewFile[];
  enabled?: boolean;
  depth?: 'diff' | 'changed-files' | 'balanced' | 'deep';
}): Promise<SupportingContextResult> {
  if (!(args.enabled ?? enabled())) return { files: [], manifest: [] };
  const tree = await fetchTree(args.repository, args.headSha, args.token);
  if (tree.size === 0) return { files: [], manifest: [] };
  const changed = new Set(args.changedFiles.map((file) => file.filename));
  const candidates = new Map<string, ContextReason>();
  for (const file of args.changedFiles) {
    if (!file.fullContent) continue;
    for (const specifier of extractImportSpecifiers(file.filename, file.fullContent)) {
      const resolved = resolveImport(file.filename, specifier, tree);
      if (resolved && !changed.has(resolved)) candidates.set(resolved, 'import');
    }
    for (const test of testCandidates(file.filename, tree)) if (!changed.has(test)) candidates.set(test, 'test');
    const directoryParts = path.posix.dirname(file.filename).split('/');
    for (let depth = directoryParts.length; depth >= 0; depth--) {
      const prefix = directoryParts.slice(0, depth).join('/');
      for (const config of Array.from(CONFIG_NAMES)) {
        const candidate = prefix ? `${prefix}/${config}` : config;
        if (tree.has(candidate) && !changed.has(candidate) && !candidates.has(candidate)) candidates.set(candidate, 'config');
      }
    }
  }
  if (args.depth === 'deep') {
    const symbols = new Set<string>();
    for (const file of args.changedFiles) {
      const matcher = /\b(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|def)\s+([A-Za-z_$][\w$]*)/g;
      let match: RegExpExecArray | null;
      while (file.fullContent && (match = matcher.exec(file.fullContent))) symbols.add(match[1]);
    }
    const changedDirectories = new Set(args.changedFiles.map((file) => path.posix.dirname(file.filename)));
    const scanLimit = integer('REVIEW_MAX_CALLER_SCAN_FILES', 30);
    const possibleCallers = Array.from(tree).filter((filename) =>
      SOURCE_EXTENSIONS.includes(path.posix.extname(filename).toLowerCase())
      && !changed.has(filename)
      && changedDirectories.has(path.posix.dirname(filename))
      && !candidates.has(filename)
      && !isExcludedContextPath(filename),
    ).slice(0, scanLimit);
    for (const filename of possibleCallers) {
      const result = await fetchRepositoryText({ repository: args.repository, path: filename, commitSha: args.headSha, token: args.token, maxChars: integer('REVIEW_MAX_CONTEXT_FILE_CHARS', 20_000) });
      if (result.content && Array.from(symbols).some((symbol) => new RegExp(`\\b${symbol}\\b`).test(result.content!))) {
        candidates.set(filename, 'caller');
      }
    }
  }
  const maxFiles = integer('REVIEW_MAX_CONTEXT_FILES', 12);
  const maxFileChars = integer('REVIEW_MAX_CONTEXT_FILE_CHARS', 20_000);
  let remaining = integer('REVIEW_MAX_TOTAL_CONTEXT_CHARS', 120_000)
    - args.changedFiles.reduce((sum, file) => sum + (file.fullContent?.length || 0), 0);
  const files: SupportingContext[] = [];
  for (const [filename, reason] of Array.from(candidates).slice(0, maxFiles)) {
    if (remaining <= 0 || isExcludedContextPath(filename)) continue;
    const result = await fetchRepositoryText({ repository: args.repository, path: filename, commitSha: args.headSha, token: args.token, maxChars: Math.min(maxFileChars, remaining) });
    if (!result.content) continue;
    const content = redactLikelySecrets(result.content);
    remaining -= content.length;
    files.push({ filename, reason, content, truncated: Boolean(result.truncated) });
  }
  return {
    files,
    manifest: files.map((file) => ({ filename: file.filename, characters: file.content.length, truncated: file.truncated, reason: file.reason })),
  };
}
