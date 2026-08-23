import type { ReviewFile } from './ai-review';

export interface ContextManifestEntry {
  filename: string;
  characters: number;
  truncated: boolean;
  reason?: string;
}

export interface ContextManifest {
  enabled: boolean;
  files: ContextManifestEntry[];
  skipped: Array<{ filename: string; reason: 'excluded' | 'removed' | 'binary' | 'too-large' | 'fetch-failed' }>;
  totalCharacters: number;
}

export interface RepositoryTextResult {
  content?: string;
  truncated?: boolean;
  reason?: 'binary' | 'too-large' | 'fetch-failed';
}

const SENSITIVE_GLOBS = [
  '**/.env*',
  '**/*.pem',
  '**/*.key',
  '**/*.p12',
  '**/*.pfx',
  '**/id_rsa*',
  '**/.npmrc',
  '**/.pypirc',
  '**/credentials*',
  '**/secrets/**',
];
const contentCache = new Map<string, { expiresAt: number; result: RepositoryTextResult }>();

const DEFAULT_REVIEW_EXCLUDES = [
  '**/package-lock.json', '**/yarn.lock', '**/pnpm-lock.yaml', '**/*.min.js', '**/*.map',
  '**/dist/**', '**/build/**', '**/vendor/**', '**/node_modules/**', '**/*.snap',
];

function envBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

function envInteger(name: string, fallback: number, minimum = 1): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

function matchesGlob(filename: string, pattern: string): boolean {
  const marker = '\u0000';
  const regex = new RegExp(
    '^' + pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, marker)
      .replace(/\*/g, '[^/]*')
      .replace(new RegExp(marker, 'g'), '.*') + '$',
  );
  return regex.test(filename) || (pattern.startsWith('**/') && matchesGlob(filename, pattern.slice(3)));
}

export function isExcludedContextPath(filename: string): boolean {
  const normalized = filename.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) return true;
  const custom = process.env.REVIEW_EXCLUDE_GLOBS;
  const reviewExcludes = custom ? custom.split(',').map((value) => value.trim()).filter(Boolean) : DEFAULT_REVIEW_EXCLUDES;
  return [...SENSITIVE_GLOBS, ...reviewExcludes].some((glob) => matchesGlob(normalized, glob));
}

export function redactLikelySecrets(content: string): string {
  return content
    .replace(/\b(gh[opsu]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/g, '[REDACTED_SECRET]')
    .replace(/((?:api[_-]?key|secret|token|password|private[_-]?key)\s*[:=]\s*["']?)[^\s"']{8,}/gi, '$1[REDACTED_SECRET]');
}

function looksBinary(buffer: Buffer): boolean {
  if (buffer.includes(0)) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  if (sample.length === 0) return false;
  let suspicious = 0;
  for (let index = 0; index < sample.length; index++) {
    const byte = sample[index];
    if (byte < 7 || (byte > 13 && byte < 32)) suspicious++;
  }
  return suspicious / sample.length > 0.1;
}

function truncateText(content: string, limit: number): { content: string; truncated: boolean } {
  if (content.length <= limit) return { content, truncated: false };
  let end = limit;
  const newline = content.lastIndexOf('\n', limit);
  if (newline >= Math.floor(limit * 0.8)) end = newline;
  return { content: content.slice(0, end), truncated: true };
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function contentUrl(repository: string, filename: string, headSha: string): string {
  const repo = repository.split('/').map(encodeURIComponent).join('/');
  const path = filename.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(headSha)}`;
}

type FetchOutcome =
  | { file: ReviewFile; content: string; truncated: boolean }
  | { file: ReviewFile; reason: 'binary' | 'too-large' | 'fetch-failed' };

async function fetchFile(file: ReviewFile, repository: string, headSha: string, token: string, explicitMaxChars?: number): Promise<FetchOutcome> {
  const maxFileChars = explicitMaxChars || envInteger('REVIEW_MAX_FULL_FILE_CHARS', 30_000);
  const timeoutMs = envInteger('REVIEW_CONTEXT_FETCH_TIMEOUT_MS', 10_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(contentUrl(repository, file.filename, headSha), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: controller.signal,
    });
    if (!response.ok) return { file, reason: response.status === 413 ? 'too-large' : 'fetch-failed' };
    const data = await response.json();
    if (Array.isArray(data) || data?.type !== 'file' || data?.encoding !== 'base64' || typeof data.content !== 'string') {
      return { file, reason: 'fetch-failed' };
    }
    const buffer = Buffer.from(data.content.replace(/\s/g, ''), 'base64');
    if (looksBinary(buffer)) return { file, reason: 'binary' };
    const text = buffer.toString('utf8');
    if (text.includes('\uFFFD')) return { file, reason: 'binary' };
    const bounded = truncateText(text, maxFileChars);
    return { file, ...bounded };
  } catch {
    return { file, reason: 'fetch-failed' };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRepositoryText(args: {
  repository: string;
  path: string;
  commitSha: string;
  token: string;
  maxChars?: number;
}): Promise<RepositoryTextResult> {
  const cacheKey = `${args.repository}:${args.commitSha}:${args.path}:${args.maxChars || ''}`;
  const cached = contentCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  const synthetic: ReviewFile = { filename: args.path, additions: 0, deletions: 0 };
  const result = await fetchFile(synthetic, args.repository, args.commitSha, args.token, args.maxChars);
  const normalized: RepositoryTextResult = 'reason' in result
    ? { reason: result.reason }
    : { content: redactLikelySecrets(result.content), truncated: result.truncated };
  const ttl = envInteger('REVIEW_CONTEXT_CACHE_TTL_MS', 60_000);
  if (contentCache.size >= 100) contentCache.delete(contentCache.keys().next().value as string);
  contentCache.set(cacheKey, { expiresAt: Date.now() + ttl, result: normalized });
  return normalized;
}

export async function attachFullFileContext(args: {
  repository: string;
  headSha: string;
  token: string;
  files: ReviewFile[];
  enabled?: boolean;
}): Promise<{ files: ReviewFile[]; manifest: ContextManifest }> {
  const manifest: ContextManifest = { enabled: args.enabled ?? envBoolean('REVIEW_INCLUDE_FULL_FILES', false), files: [], skipped: [], totalCharacters: 0 };
  const cloned = args.files.map((file) => ({ ...file, fullContent: undefined, fullContentTruncated: undefined }));
  if (!manifest.enabled) return { files: cloned, manifest };

  const candidates: ReviewFile[] = [];
  for (const file of cloned) {
    if (file.status === 'removed') manifest.skipped.push({ filename: file.filename, reason: 'removed' });
    else if (isExcludedContextPath(file.filename)) manifest.skipped.push({ filename: file.filename, reason: 'excluded' });
    else candidates.push(file);
  }

  const maxFiles = envInteger('REVIEW_MAX_FILES', 40);
  const selectedCandidates = candidates.slice(0, maxFiles);
  for (const file of candidates.slice(maxFiles)) {
    manifest.skipped.push({ filename: file.filename, reason: 'too-large' });
  }

  const concurrency = envInteger('REVIEW_CONTEXT_FETCH_CONCURRENCY', 4);
  const outcomes = await mapWithConcurrency(selectedCandidates, concurrency, (file) =>
    fetchFile(file, args.repository, args.headSha, args.token),
  );
  let remaining = envInteger('REVIEW_MAX_TOTAL_CONTEXT_CHARS', 120_000);
  for (const outcome of outcomes) {
    if ('reason' in outcome) {
      manifest.skipped.push({ filename: outcome.file.filename, reason: outcome.reason });
      continue;
    }
    if (remaining <= 0) {
      manifest.skipped.push({ filename: outcome.file.filename, reason: 'too-large' });
      continue;
    }
    const bounded = truncateText(outcome.content, remaining);
    outcome.file.fullContent = redactLikelySecrets(bounded.content);
    outcome.file.fullContentTruncated = outcome.truncated || bounded.truncated;
    remaining -= bounded.content.length;
    manifest.totalCharacters += bounded.content.length;
    manifest.files.push({
      filename: outcome.file.filename,
      characters: bounded.content.length,
      truncated: Boolean(outcome.file.fullContentTruncated),
    });
  }
  return { files: cloned, manifest };
}

function boundedBeforeAfter(before: string, after: string, limit: number): string {
  const half = Math.max(1, Math.floor((limit - 80) / 2));
  const oldText = truncateText(before, half);
  const newText = truncateText(after, half);
  return `--- BASE${oldText.truncated ? ' (truncated)' : ''}\n${oldText.content}\n--- HEAD${newText.truncated ? ' (truncated)' : ''}\n${newText.content}`;
}

export async function attachMissingPatchContext(args: {
  repository: string;
  baseSha?: string;
  token: string;
  files: ReviewFile[];
  enabled: boolean;
}): Promise<ReviewFile[]> {
  if (!args.enabled || !args.baseSha) return args.files;
  const maxChars = envInteger('REVIEW_MAX_MISSING_PATCH_CHARS', 20_000);
  for (const file of args.files) {
    if (file.patch || file.status === 'removed' || !file.fullContent || isExcludedContextPath(file.filename)) continue;
    const base = await fetchRepositoryText({ repository: args.repository, path: file.filename, commitSha: args.baseSha, token: args.token, maxChars: Math.floor(maxChars / 2) });
    if (base.content !== undefined) file.reasoningPatch = boundedBeforeAfter(base.content, file.fullContent, maxChars);
  }
  return args.files;
}
