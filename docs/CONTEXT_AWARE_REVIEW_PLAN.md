# Context-Aware Code Review Plan

Status: planned  
Created: 2026-08-23  
Priority: high — review quality improvement  
Depends on: secure GitHub App installation access and account-level BYOK

## Objective

Improve Mega-Miyya from a diff-only reviewer into a context-aware reviewer that can understand surrounding implementation, related types, imported functions, schemas, configuration, and tests while still posting comments only on changed lines.

The reviewer must remain bounded, privacy-conscious, and predictable in LLM cost. It must not upload an entire repository indiscriminately.

## Current behavior

The webhook pipeline currently:

1. Receives a signed pull-request webhook.
2. Creates a short-lived GitHub App installation token.
3. Calls GitHub's pull-request files API.
4. Extracts each changed file's unified-diff `patch`.
5. Annotates right-side lines with actual new-file line numbers.
6. Sends the repository name, PR title/description, and annotated patches to the configured customer LLM.
7. Validates findings against commentable diff lines.
8. Posts inline comments and an upserted summary.

Current context includes only the patch hunks and GitHub-provided nearby lines. It does not include complete changed files or related repository files.

Current limitations:

- Maximum review files default: 40.
- Maximum diff prompt characters default: 60,000.
- Removed files are skipped.
- Binary files are skipped.
- Files without a GitHub `patch`, including some large diffs, are skipped.
- The model cannot inspect definitions located outside the diff.
- Cross-file bugs can be missed.
- Imports, callers, tests, schemas, and configuration are not resolved.

## Target review flow

```text
Verified PR webhook
        |
        v
Fetch and parse changed diffs
        |
        v
Fetch bounded full versions of changed files at the PR head SHA
        |
        v
Discover potentially relevant supporting files
        |
        v
Rank and select context within a strict token/character budget
        |
        v
Redact likely secrets and excluded content
        |
        v
Send diff + labeled supporting context to the customer's LLM
        |
        v
Validate and post findings only on changed lines
```

## Context tiers

Context should be selected in tiers so the highest-value material is retained when limits are reached.

### Tier 1: always include

- PR title and bounded description.
- Annotated changed diff.
- Full new version of each changed text file, subject to size limits.
- Repository and file names.

### Tier 2: high-value related context

- Direct local imports from changed files.
- Definitions of types, functions, classes, and constants referenced by changed lines.
- Tests matching the changed file or symbol.
- Schemas, migrations, API contracts, and validation code directly referenced by the change.
- Project-level reviewer instructions, when supported.

### Tier 3: optional context

- Callers of a changed exported symbol.
- Package and compiler configuration relevant to changed files.
- Neighboring implementation files in the same feature directory.
- Base-branch version of a changed file when the patch is unavailable or semantic before/after comparison is valuable.

Tier 3 must be omitted first when the context budget is exhausted.

## GitHub data access

Use the verified webhook's installation ID and a short-lived installation token. Fetch content at immutable commit SHAs:

- New content: PR `head.sha`.
- Old content when required: PR base SHA.

Candidate GitHub APIs:

- Pull-request files API for patches and changed-file metadata.
- Repository contents API with `ref=<commit-sha>` for smaller files.
- Git blobs API for files where contents API behavior or size makes it necessary.
- Git trees API for bounded path discovery when resolving related files.

Never use the default branch implicitly for PR context because it may differ from the reviewed commit.

## Proposed data structures

Extend the review input without mixing source context with comment anchors:

```ts
interface ReviewFile {
  filename: string;
  patch?: string;
  additions: number;
  deletions: number;
  status?: string;
  fullContent?: string;
}

interface SupportingContext {
  filename: string;
  reason: 'import' | 'symbol' | 'test' | 'schema' | 'config' | 'caller';
  content: string;
  truncated: boolean;
}

interface ReviewRequest {
  repository: string;
  pullRequest: PullRequestInfo;
  files: ReviewFile[];
  supportingContext: SupportingContext[];
}
```

Diffs remain the only source for valid inline-comment locations. Full files and supporting files are read-only reasoning context.

## Context discovery strategy

Start with deterministic discovery rather than repository-wide embeddings.

1. Detect language from filename.
2. Parse common import syntax for TypeScript/JavaScript initially.
3. Resolve relative imports against repository paths.
4. Match common test naming conventions:
   - `file.test.ts`
   - `file.spec.ts`
   - `__tests__/file.ts`
   - nearby integration tests
5. Include directly referenced schemas/configuration using import resolution.
6. Rank candidates using deterministic signals:
   - directly imported by a changed file
   - referenced by a changed line
   - matching test name
   - same package/module
   - smaller file preferred when value is otherwise equal

Later iterations may add language parsers, code indexes, or embeddings after deterministic context selection is measured.

## Prompt design

Clearly separate changed material from context:

```text
--- CHANGED DIFFS ---
Only these lines may receive findings.

--- FULL CHANGED FILES ---
Use these to understand surrounding control flow.

--- SUPPORTING CONTEXT ---
Use these files for reasoning only. Do not report findings on their lines.
```

The system prompt must continue requiring:

- Findings only for changed lines.
- Exact changed-file path and valid right-side line number.
- No issues reported solely in supporting files.
- No speculative findings unsupported by the supplied context.
- High-signal feedback rather than broad repository critique.

## Privacy and security requirements

- Send context only to the LLM provider configured by the repository's GitHub account/company.
- Explain in the dashboard that full changed files and selected supporting files may be sent to that provider.
- Provide an organization setting to disable supporting context.
- Honor repository exclusion patterns before fetching or transmitting content.
- Never fetch `.env`, private keys, credential files, generated secrets, or explicitly excluded paths.
- Add a best-effort secret redaction pass before prompt construction.
- Do not log file contents, prompt bodies, or provider responses containing source.
- Do not persist full source context in MongoDB or queue payloads.
- Keep source content in worker memory only for the review duration.
- Pass repository IDs, SHAs, and credential record references to jobs rather than source text.
- Validate all requested paths originate from the verified repository and commit.

Initial sensitive-path exclusions should include patterns such as:

```text
**/.env*
**/*.pem
**/*.key
**/*.p12
**/*.pfx
**/id_rsa*
**/.npmrc
**/.pypirc
**/credentials*
**/secrets/**
```

These exclusions complement secret scanning; neither control is sufficient alone.

## Cost and performance limits

Add explicit configuration with conservative defaults:

```env
REVIEW_INCLUDE_FULL_FILES=true
REVIEW_INCLUDE_SUPPORTING_CONTEXT=true
REVIEW_MAX_FULL_FILE_CHARS=30000
REVIEW_MAX_CONTEXT_FILES=12
REVIEW_MAX_CONTEXT_FILE_CHARS=20000
REVIEW_MAX_TOTAL_CONTEXT_CHARS=120000
REVIEW_CONTEXT_FETCH_CONCURRENCY=4
REVIEW_CONTEXT_FETCH_TIMEOUT_MS=10000
```

Required behavior:

- Apply per-file and total budgets before constructing the LLM request.
- Truncate at safe text boundaries and label truncated content.
- Prefer diff and Tier 1 content over supporting files.
- Limit concurrent GitHub requests.
- Cache immutable `(repositoryId, commitSha, path)` content briefly where safe, without logging or persisting source indefinitely.
- Record metadata such as selected context filenames, character counts, and reasons without recording contents.

## Large, removed, and binary files

- Binary files: report that they were not reviewable; never send binary content to an LLM.
- Removed files: keep their diff for reasoning when available, but do not attempt right-side inline comments.
- Missing GitHub patches: fetch the head/base versions when size permits and generate or obtain a bounded diff.
- Oversized text files: include only relevant windows around changed hunks, imports, and referenced definitions.
- Generated/minified/vendored files: continue excluding by default.

## Implementation phases

### Phase 1: full changed-file context

- Fetch full changed text files at `head.sha`.
- Add content type, binary, and size validation.
- Extend review request types and prompt sections.
- Preserve changed-line-only comment validation.
- Add configuration flags and metrics.
- Add tests proving the LLM receives full context but cannot anchor comments outside the diff.

### Phase 2: deterministic related-file context

- Implement relative import parsing for TypeScript/JavaScript.
- Resolve matching test files.
- Rank candidates and enforce total budgets.
- Label every context file with the selection reason.
- Add exclusions and secret redaction.
- Add tests for path resolution, traversal rejection, exclusions, and budget ordering.

### Phase 3: broader language and symbol support

- Add parsers/resolvers for the languages most frequently used by customers.
- Add symbol definition and caller discovery.
- Measure which context types improve accepted findings.
- Consider a repository index only after deterministic selection metrics justify it.

### Phase 4: customer controls and observability

- Organization/repository settings for context depth.
- Per-review context manifest visible to administrators without source contents.
- Cost/token metrics by provider, model, repository, and context tier.
- Feedback metrics for accepted/dismissed findings.
- Safe fallback to diff-only review when context fetching fails.

## Acceptance criteria for Phase 1

- Full new content is fetched only for changed text files within configured limits.
- Content is fetched at the exact PR head SHA.
- No full source content is stored in MongoDB or application logs.
- Excluded and sensitive paths are not fetched for context.
- LLM prompts clearly distinguish diffs from full-file context.
- Findings outside changed lines are discarded or snapped according to the existing anchor policy.
- A GitHub API failure for one context file does not fail the entire review.
- Diff-only review remains available as a fallback.
- Unit tests cover size limits, missing patches, excluded paths, binary files, and invalid model line references.
- Review metadata records context counts and truncation without recording source.

## Success metrics

- Increased percentage of findings accepted or resolved by developers.
- Reduced false-positive/dismissal rate.
- More valid cross-file and nullability/type-contract findings.
- No material increase in comments outside the actual scope of a PR.
- Review latency and customer LLM cost remain within documented limits.
- No source-context leakage into logs, MongoDB, unrelated tenants, or the wrong LLM credential.

## Open decisions

- Should full changed-file context be enabled by default for all hosted accounts?
- What initial total character/token budget is acceptable for customer-paid LLM usage?
- Should customers choose `diff only`, `balanced`, or `deep` context profiles?
- Which secret-scanning library or service should run before transmission?
- Should supporting context filenames be included in the public PR summary or only in the private dashboard?
- Which language should follow TypeScript/JavaScript support?
- Should missing-patch files be reviewed using locally generated diffs in Phase 1 or a later phase?

## Recommended next action

Implement Phase 1 behind `REVIEW_INCLUDE_FULL_FILES`, defaulting to false until privacy disclosure, size limits, tests, and review-cost measurements are complete.
