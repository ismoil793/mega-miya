# Mega Miya (Mega Mind) is an open source AI-Powered Code Reviewing Tool

<img width="250" height="250" alt="mega-miya-2" src="https://github.com/user-attachments/assets/45cfa5c4-73b9-4a58-945e-6dcff69da75d" />

An intelligent code review tool that automatically analyzes pull requests using AI and provides detailed feedback directly on GitHub, similar to CodeRabbit.

## Features

- 💬 **Line-by-line inline comments**: Anchored to the exact changed lines via the GitHub Reviews API, with applyable ```suggestion``` fixes — just like CodeRabbit / Cursor Bugbot.
- 📝 **Upserted summary comment**: One overview comment per PR (score + findings) that's edited in place on each push instead of spamming new comments.
- 🧠 **Bring your own LLM**: Native Claude (Anthropic), any OpenAI-compatible endpoint (OpenAI, vLLM, OpenRouter, Together, Groq, LM Studio, self-hosted), or local Ollama.
- 🏢 **Self-host for any company**: Run it on your own server, point it at your LLM, install the GitHub App — with `REVIEW_ALL_REPOS=true` it reviews every installed repo, no per-repo setup.
- 🎯 **Diff-aware, low-noise**: The model reviews only changed lines, validated against the diff so comments never land on the wrong line; tunable severity floor and size caps.
- 📈 **Dashboard & history**: Optional MongoDB-backed dashboard to track reviews (the bot works without it too).

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: MongoDB (optional — dashboard & history)
- **AI**: Anthropic Claude, OpenAI / OpenAI-compatible, Ollama
- **GitHub**: GitHub App (reviews) + OAuth (dashboard)
- **Deployment**: Vercel-ready or any Node host

## 🚀 Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd mega-miya
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Set up GitHub OAuth App:**
   - Create a GitHub OAuth App at [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)
   - Set Homepage URL to `http://localhost:3004`
   - Set Authorization callback URL to `http://localhost:3004/api/auth/callback`
   - Copy Client ID and Client Secret to `.env.local`

4. **Set up GitHub App (Optional - for bot comments):**
   - Follow the [GitHub App Setup Guide](GITHUB_APP_SETUP.md) to enable bot comments
   - This makes AI reviews appear under the bot's name instead of your personal account

5. **Set up AI provider:**
   - Choose your provider with `AI_PROVIDER` (`anthropic`, `openai`, `openai-compatible`, or `ollama`)
   - Set the matching API key/model in `.env.local` (see the [Environment Variables](#environment-variables) table)
   - For a self-hosted or third-party OpenAI-compatible gateway, set `AI_PROVIDER=openai-compatible` and `OPENAI_BASE_URL`

6. **Start the development server:**
   ```bash
   npm run dev
   ```

7. **Connect your GitHub account:**
   - Visit `http://localhost:3004`
   - Click "Connect GitHub" and authorize the application
   - Select repositories for AI review

8. **Set up webhooks:**
   - Go to your GitHub App settings
   - The webhook URL is already configured: `http://localhost:3004/api/webhooks/github`
   - Webhook secret should match `GITHUB_WEBHOOK_SECRET`
   - The app will automatically receive events for all installed repositories

## Usage

### 1. Connect GitHub
- Click "Connect GitHub" on the dashboard
- Authorize the application
- You'll be redirected back with your GitHub account connected

### 2. Select Repositories
- Click "Select Repositories" in the user info section
- Choose which repositories to enable AI reviews for
- Only repositories where you have admin access will be shown

### 3. Install GitHub App (Optional)
- Use the GitHub App installation UI to install the app on your repositories
- This enables bot comments instead of personal comments
- Webhooks are automatically configured at the app level

### 4. Create Pull Requests
- Create a new PR in any enabled repository
- The AI will automatically analyze the code and post a review comment
- Check the dashboard to see review history and analytics

## How It Works

1. **Webhook Trigger**: When a PR is opened/updated/reopened, GitHub sends a webhook to `/api/webhooks/github` (signature-verified).
2. **Repository Check**: With `REVIEW_ALL_REPOS=true` every installed repo is reviewed; otherwise only repos opted-in from the dashboard.
3. **Diff Analysis**: Fetches the PR's changed files, parses each unified diff, and annotates every changed line with its real line number.
4. **AI Review**: The configured LLM reviews only the changed lines and returns structured findings (file + line + severity + suggested fix).
5. **Post to GitHub**: Findings are validated against the diff and posted as **inline review comments** (with ```suggestion``` blocks), plus a single **summary comment** that's upserted on each push.
6. **Dashboard Update** *(optional)*: Review data is stored in MongoDB for history and analytics.

## Self-hosting for your company

1. Deploy this app anywhere it can run Node and receive GitHub webhooks (Vercel, a container, a VM).
2. Create a GitHub App (see [GITHUB_APP_SETUP.md](GITHUB_APP_SETUP.md)) with **Pull requests: Read & write** and **Contents: Read**, subscribed to **Pull request** events, webhook URL `https://<your-host>/api/webhooks/github`.
3. Set `REVIEW_ALL_REPOS=true`, one LLM provider's key, and the GitHub App credentials in your environment.
4. Install the App on the org/repos you want reviewed. Open a PR — inline comments and a summary appear automatically. No per-repo configuration required.

## API Endpoints

- `GET /api/auth/me` - Get current user session
- `POST /api/auth/logout` - Logout user
- `GET /api/repositories` - Fetch user's GitHub repositories
- `POST /api/repositories` - Update selected repositories
- `POST /api/webhooks/github` - GitHub webhook handler
- `GET /api/reviews` - Get review history
- `POST /api/github-app/installation-status` - Check GitHub App installation status
- `GET /api/llm-settings` - List configurable GitHub accounts and provider status
- `PUT /api/llm-settings` - Encrypt and save an account-level provider credential
- `DELETE /api/llm-settings` - Delete an account-level provider credential
- `GET /api/github-app/cache-stats` - Get installation ID cache statistics
- `DELETE /api/github-app/cache-stats` - Clear all installation ID cache

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REQUIRE_BYOK` | Require an account-level customer LLM credential; prevents fallback to a deployment key | Recommended true for hosted mode |
| `AI_API_CREDENTIAL_ENCRYPTION_KEY` | Base64-encoded 32-byte AES key used to encrypt customer LLM credentials | For hosted BYOK |
| `AI_PROVIDER` | `anthropic` \| `openai` \| `openai-compatible` \| `ollama` | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key | If provider = anthropic |
| `ANTHROPIC_MODEL` | Claude model (default `claude-opus-4-8`) | No |
| `OPENAI_API_KEY` | OpenAI (or compatible endpoint) API key | If provider = openai/openai-compatible |
| `OPENAI_MODEL` | Model name (default `gpt-5.4`) | No |
| `OPENAI_BASE_URL` | Base URL for an OpenAI-compatible endpoint | If provider = openai-compatible |
| `OLLAMA_URL` | Ollama server URL (default `http://localhost:11434`) | If provider = ollama |
| `OLLAMA_MODEL` | Ollama model name (default `codellama`) | If provider = ollama |
| `LLM_MAX_TOKENS` / `LLM_TEMPERATURE` | Generation tuning | No |
| `GITHUB_APP_ID` | GitHub App ID | Yes |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key | Yes |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret (verifies incoming webhooks) | Recommended |
| `REVIEW_ALL_REPOS` | Review every installed repo without DB opt-in | No (default false) |
| `MIN_SEVERITY` | Minimum severity for inline comments | No (default low) |
| `REVIEW_MAX_FILES` / `REVIEW_MAX_DIFF_CHARS` | Safety caps for large PRs | No |
| `REVIEW_EXCLUDE_GLOBS` | Comma-separated globs to skip | No |
| `MONGODB_URI` | MongoDB connection (dashboard/history) | No |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth (dashboard sign-in) | For dashboard |
| `NEXTAUTH_URL` / `NEXTAUTH_SECRET` / `JWT_SECRET` | App auth secrets | For dashboard |

> **Note**: Installation IDs are detected automatically per repository — no need to configure `GITHUB_APP_INSTALLATION_ID`.

### Optional per-organization repository limits

Hosted operators can limit how many repositories are enabled for an individual GitHub App installation by setting `repositoryLimit` on its `githubinstallations` MongoDB document. The limit is shared across users who administer that installation. Leave the field absent for unlimited repositories, which is the default for self-hosted deployments.

```javascript
// Allow at most two enabled repositories for this GitHub organization.
db.githubinstallations.updateOne(
  { installationId: 12345678 },
  { $set: { repositoryLimit: 2 } }
)

// Restore unlimited repository enablement.
db.githubinstallations.updateOne(
  { installationId: 12345678 },
  { $unset: { repositoryLimit: "" } }
)
```

The repository API enforces the limit server-side. `REVIEW_ALL_REPOS=true` intentionally bypasses dashboard opt-in and is therefore intended only for unrestricted self-hosted installations.

## Development

### Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── repositories/  # Repository management
│   │   ├── reviews/       # Review data
│   │   └── webhooks/      # GitHub webhooks
│   ├── globals.css        # Global styles
│   └── page.tsx           # Dashboard page
├── components/            # React components
├── lib/                   # Utility libraries
│   ├── ai-review.ts       # AI review generation
│   └── database.ts        # Database connection
└── models/                # MongoDB models
```

### Adding New AI Providers

1. Add the provider case in `src/lib/ai-review.ts`
2. Implement the review generation function
3. Add environment variables for the provider
4. Update the README with setup instructions

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

- Update `NEXTAUTH_URL` to your production domain
- Ensure all API keys and secrets are properly set
- Use a production MongoDB cluster

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

**GNU Affero General Public License v3.0 (AGPL-3.0)**

Copyright (C) 2026 [Ismoil](https://github.com/ismoil793).

This project is licensed under the GNU Affero General Public License v3.0 or later. Modified versions distributed to others, or made available for users over a network, are subject to the source-code requirements of the AGPL.

See [LICENSE](LICENSE) for the complete license terms and [NOTICE](NOTICE) for attribution information.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the documentation
- Review the code examples

## GitHub App Setup

Follow the [GitHub App Setup Guide](GITHUB_APP_SETUP.md) to enable bot comments on pull requests.

### Installation ID Caching

The system automatically caches GitHub App installation IDs to improve performance:

- **Cache Strategy**: Per owner/organization (not per repository)
- **Cache Duration**: 24 hours
- **Automatic Invalidation**: When GitHub App is uninstalled
- **Manual Clear**: Use `DELETE /api/github-app/cache-stats`
- **Cache Stats**: Use `GET /api/github-app/cache-stats`

**Why per owner?** Installation IDs are the same for all repositories under the same GitHub account/organization where the app is installed. This reduces API calls and improves performance.

---

Built with ❤️ using Next.js, TypeScript, and AI 
