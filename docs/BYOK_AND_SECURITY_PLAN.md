# Mega-Miyya BYOK and Security Plan

Status: planning document  
Created: 2026-08-21  
Last updated: 2026-08-23
Purpose: preserve decisions and implementation context for the next working session.

## Progress log

### 2026-08-23: authentication hardening started

- Replaced forgeable base64 identity cookies with random, opaque sessions whose SHA-256 hashes and expirations are stored server-side.
- Added real server-side logout/revocation and a MongoDB TTL index for expired sessions.
- Replaced weak OAuth state generation with cryptographic randomness and added one-time state validation in the callback.
- Added same-origin checks to state-changing dashboard endpoints.
- Added authentication and current-user repository scoping to review APIs.
- Added server-side validation that selected repositories are repositories the current OAuth user administers.
- Protected installation-status and cache/debug routes; cache controls are unavailable in production.
- Added a two-megabyte webhook payload limit and made a missing webhook secret fail closed in production.

Important transition note: existing base64 sessions are intentionally invalid after this change, so users must connect again. The follow-up Option A migration below removes the repository picker’s dependency on the broad OAuth `repo` token.

### 2026-08-23: Option A repository-access migration

- Reduced OAuth authorization to identity and organization membership scopes.
- Stopped persisting new OAuth access tokens and marked the old token field as a legacy migration field.
- Added authorized GitHub account memberships to users; organization administration is recorded from GitHub during login.
- Added persistent GitHub App installation and installed-repository records.
- Added verified webhook handling for installation creation, deletion, suspension, restoration, and repository additions/removals.
- Changed the repository picker to show only repositories delivered through GitHub App installation events.
- Bound PR review eligibility to the installation ID and repository contained in the signed webhook.
- Added an installation link to the repository picker empty state.

Migration requirement: users must reconnect through OAuth to populate identity/account membership data. Existing GitHub App installations must emit a fresh installation event (reinstall or redeliver the installation delivery) so their repositories are imported.

### 2026-08-23: first hosted BYOK implementation

- Added one active LLM credential per administrated GitHub user/organization account.
- Added OpenAI and Anthropic provider/model selection in the dashboard.
- Added AES-256-GCM authenticated encryption with a unique nonce for each saved key.
- The encryption master key is supplied separately through `AI_API_CREDENTIAL_ENCRYPTION_KEY` and is never stored in MongoDB.
- Credential APIs never return ciphertext or the original API key; the UI receives only provider, model, and the last four characters.
- Webhook jobs resolve the credential from the verified GitHub installation account and decrypt it only immediately before the provider request.
- `REQUIRE_BYOK=true` prevents fallback to a deployment-owned LLM key when customer configuration is missing or broken.
- Arbitrary OpenAI-compatible and Ollama endpoints remain disabled in hosted BYOK because URL support requires the planned SSRF controls.

Production follow-up: replace the environment-held encryption master key with envelope encryption backed by the selected cloud KMS and add provider connection testing before public onboarding.

## Product decision

Mega-Miyya should support **bring your own key (BYOK)**. Hosted customers pay their LLM provider directly by supplying their own credential. Mega-Miyya hosts the GitHub integration, webhook processing, review orchestration, and dashboard, but does not subsidize customer LLM usage.

The intended hosted onboarding flow is:

1. Sign in.
2. Install the shared Mega-Miyya GitHub App.
3. Select repositories.
4. Select an LLM provider and securely add a credential.
5. Test the provider connection.
6. Open a pull request and receive a review.

Self-hosted deployments may continue using environment variables and local/OpenAI-compatible endpoints.

Authentication decision (2026-08-23): retain two GitHub registrations. The OAuth App is identity-only (`read:user`, `user:email`, and `read:org`). The Mega-Miyya GitHub App exclusively owns repository access, webhook delivery, and review posting. OAuth repository tokens must not be stored.

## Current architecture

- `src/lib/llm.ts` reads one global provider configuration from process environment variables.
- Supported providers are OpenAI, OpenAI-compatible APIs, Anthropic, and Ollama.
- Webhook processing does not currently resolve an organization/repository-specific provider configuration.
- New OAuth logins no longer persist a GitHub token; the optional user token field remains temporarily only for legacy-record cleanup.
- GitHub App installations and their repository grants are persisted, while review enablement is still attached directly to a user pending the organization model.
- Review records are not currently tenant-isolated at the API layer.

This architecture is acceptable for local development, but it is not safe for unrelated hosted customers.

## Target tenant model

Do not attach company credentials to an individual user. Introduce explicit tenant records:

- `Organization`
  - internal ID
  - GitHub account/organization ID and login
  - billing/plan state (later)
  - retention and privacy settings
- `Membership`
  - organization ID
  - user ID
  - role: owner, admin, member
- `GitHubInstallation`
  - organization ID
  - GitHub installation ID
  - installed account ID
  - installation status and timestamps
- `Repository`
  - organization ID
  - GitHub installation ID
  - immutable GitHub repository ID
  - owner/name for display
  - enabled state and review settings
- `LLMCredential`
  - organization ID
  - provider
  - encrypted secret fields only
  - model and allowed base URL
  - key version, creation/update timestamps, and last successful validation
  - optional non-secret label or last four characters for identification

Every webhook job and database query must carry an `organizationId` derived from the verified GitHub installation ID. Never derive tenant access solely from an owner/name string supplied by a browser.

## BYOK design

### Provider configuration

Refactor `callLLM` so it receives an explicit, resolved configuration rather than reading customer values from global environment variables:

```ts
interface LLMConfig {
  provider: 'openai' | 'openai-compatible' | 'anthropic' | 'ollama';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

callLLM(request, config)
```

Resolution order:

1. Repository-specific configuration, if supported later.
2. Organization BYOK configuration.
3. Deployment environment configuration for self-hosted/single-tenant mode.
4. Fail safely with a clear setup message; never silently charge a platform-owned fallback key.

### Credential storage

- Never store an LLM key as plaintext.
- Use authenticated envelope encryption (for example AES-256-GCM with a unique nonce per secret).
- Keep the master key outside MongoDB in a managed KMS/secret vault.
- Store ciphertext, nonce/IV, authentication tag, encryption key version, and provider metadata.
- Decrypt only inside the background review worker immediately before making the provider request.
- Never return a decrypted credential from an API, dashboard loader, log, exception, or analytics event.
- Never place a credential in a job payload or queue message. Pass a credential record ID and resolve it inside the worker.
- Support key rotation and credential revocation.
- Show only a label/status in the UI, not a recoverable key.

For the first local prototype, an application encryption key in an environment variable can be used, but production must move the master key to KMS. Database disk encryption alone is insufficient because a stolen database credential can still read plaintext fields.

### Provider validation

- Provide a server-side `Test connection` action.
- Authenticate and authorize the caller as an organization owner/admin.
- Apply rate limits and a short timeout.
- Make the smallest practical provider request.
- Return a normalized success/error result without echoing provider response headers or credentials.
- Do not persist raw provider error bodies; they can contain sensitive account information.

### OpenAI-compatible base URLs and SSRF

Allowing arbitrary base URLs creates server-side request forgery risk. For the hosted product:

- Prefer an allowlist of supported public providers.
- Require HTTPS.
- Reject credentials embedded in URLs.
- Reject localhost, loopback, link-local, private-network, metadata-service, and non-public resolved addresses.
- Re-check DNS/IP at connection time to mitigate DNS rebinding.
- Disable or tightly control redirects.
- Apply connection, response-size, and total-request timeouts.

Arbitrary Ollama/private endpoints should be a self-hosted feature unless a deliberate secure networking product is built.

### Data disclosure controls

The dashboard must tell administrators exactly what is sent to their provider:

- PR title and description
- changed filenames
- selected diff content
- reviewer system prompt

Add configurable exclusion patterns, maximum diff sizes, secret scanning/redaction before transmission, and a clear statement that the customer's agreement with its chosen LLM provider governs the provider's retention and training behavior.

## Security release blockers

These are required before allowing arbitrary companies to connect private repositories.

### P0: authentication and authorization

- Replace the forgeable base64 `session_token` with a signed, expiring session or an opaque random server-side session.
- Validate session expiry and revoke sessions on logout/security events.
- Validate OAuth `state` against the one-time cookie and delete it after use.
- Add CSRF protection to state-changing dashboard routes.
- Require authentication on `/api/reviews` and all management/debug endpoints.
- Enforce organization membership and role authorization on every request.
- Tenant-scope every review, repository, credential, and settings query.
- Verify current GitHub membership/permissions for sensitive organization changes.

### P0: remove broad GitHub user credentials

- Stop requesting the OAuth App's broad `repo` scope.
- Do not store a long-lived repository-capable GitHub OAuth token.
- Use short-lived GitHub App installation tokens for repository reads and review writes.
- Store installation IDs, not installation tokens.
- Use OAuth/GitHub user authorization only for identity where necessary and request minimum permissions.
- Revoke and delete legacy stored OAuth tokens after migration.

### P0: webhook and repository integrity

- Require `GITHUB_WEBHOOK_SECRET` in hosted production and fail closed when absent.
- Continue timing-safe signature validation over the raw request body.
- Persist and deduplicate GitHub delivery IDs to prevent replay/duplicate work.
- Resolve the tenant from the verified `installation.id`.
- Verify the repository belongs to that installation and is enabled.
- Handle installation suspension, deletion, repository removal, and permission-change events.
- Validate webhook payload size before parsing.

### P0: secret handling

- Rotate previously exposed GitHub/webhook secrets and remove obsolete credentials.
- Use a managed secret store for the GitHub App private key, OAuth secret, database credentials, session keys, and encryption master keys.
- Ensure secrets never appear in source control, logs, review output, error reporting, or client bundles.
- Add automated secret scanning and dependency/code scanning in CI.
- Define credential rotation and incident-response procedures.

### P1: API and infrastructure hardening

- Remove or admin-protect cache/debug endpoints.
- Validate repository selections against the authenticated installation; do not accept arbitrary repository names.
- Use immutable GitHub numeric IDs for authorization decisions.
- Add input schemas, maximum pagination limits, rate limiting, and abuse controls.
- Add security headers and a restrictive Content Security Policy.
- Restrict MongoDB network access; use TLS, least-privilege DB users, MFA, backups, and audited access.
- Separate web request processing from durable background review jobs. Do not depend on fire-and-forget promises in serverless handlers.
- Add queue idempotency, retry limits, timeouts, concurrency limits, and per-tenant quotas.
- Ensure logs contain metadata rather than source diffs or prompt bodies.

### P1: privacy and customer controls

- Add account/organization deletion and GitHub uninstall cleanup.
- Define review/source-data retention and allow administrators to shorten it.
- Minimize stored PR content; consider storing findings and hashes/metadata rather than full diffs.
- Publish a privacy policy, terms, subprocessors list, security contact, and incident policy before public launch.
- Prepare a data-processing agreement for business customers.
- Document which party is responsible for LLM-provider terms, cost, retention, regional processing, and acceptable use.
- Provide export and deletion workflows and record auditable admin actions.

### P2: assurance and operations

- Add security-focused unit/integration tests for cross-tenant access, session forgery, OAuth state, webhook signatures, replay, and credential leakage.
- Add monitoring for abnormal webhook rates, repeated authorization failures, token failures, and unusual provider spending.
- Perform threat modeling and an independent penetration test before serious enterprise onboarding.
- Establish backups, restore testing, availability targets, and a vulnerability disclosure process.

## Suggested implementation sequence

1. Add proper sessions and shared authorization helpers.
2. Introduce organization, membership, installation, and repository models.
3. Migrate webhook processing to tenant resolution by installation ID.
4. Remove the OAuth `repo` scope and plaintext GitHub access-token dependency.
5. Lock down all existing API endpoints and add cross-tenant tests.
6. Introduce encrypted organization-level LLM credentials.
7. Refactor `llm.ts` to accept explicit per-job configuration.
8. Build provider setup/test UI with SSRF controls.
9. Move review execution to a durable queue/worker.
10. Add retention, uninstall cleanup, auditing, rate limits, and operational documentation.

## Decisions to make together

- Initial hosted providers: OpenAI and Anthropic only, or also a curated OpenAI-compatible allowlist?
- Should an organization have one credential, one per provider, or repository overrides?
- Which KMS/cloud deployment platform will hold encryption keys?
- Should review results be retained, and for how long by default?
- Is source/diff content ever stored, or only held in memory during a job?
- Will free/open-source users be self-hosted only, with hosted BYOK as the paid product?
- Do customers need organization SSO immediately, or can verified GitHub organization administration be the first authorization model?
- What happens when a customer's key fails or exhausts quota: retry, pause, or post a setup/status comment?

## Proposed next-session agenda

1. Agree on the tenant data model.
2. Choose the session/authentication approach.
3. Decide whether to eliminate the separate OAuth App by using GitHub App user authorization.
4. Choose the first supported BYOK providers and encryption/KMS strategy.
5. Convert the implementation sequence above into small tracked issues.
6. Start with the P0 session and tenant-isolation work before building the credential UI.

## Non-goals for the first BYOK release

- Hosting or subsidizing customer LLM usage.
- Arbitrary private-network model endpoints in the hosted service.
- Per-user LLM credentials when an organization-level credential is sufficient.
- Returning stored credentials to the UI.
- Building billing before authentication, tenant isolation, and secret storage are safe.
