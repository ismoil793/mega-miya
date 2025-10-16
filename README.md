# Mega Miyya (Mega Mind) - AI-Powered Code Reviewing Tool

<img width="1024" height="1024" alt="mega-miyya-2" src="https://github.com/user-attachments/assets/45cfa5c4-73b9-4a58-945e-6dcff69da75d" />


An intelligent code review tool that automatically analyzes pull requests using AI and provides detailed feedback directly on GitHub, similar to CodeRabbit.

## Features

- 🤖 **AI-Powered Reviews**: Automatic code analysis using OpenAI, Ollama, or Hugging Face
- 🔗 **GitHub Integration**: Seamless OAuth connection and webhook setup
- 📊 **Repository Management**: Select which repositories to enable AI reviews for
- 💬 **Direct Comments**: AI reviews posted directly on GitHub PRs
- 📈 **Dashboard Analytics**: Track review history and performance
- 🔧 **Multiple AI Providers**: Support for OpenAI, local Ollama models, and Hugging Face

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: MongoDB Atlas
- **AI**: OpenAI GPT-4, Ollama (local), Hugging Face
- **Authentication**: GitHub OAuth
- **Deployment**: Vercel-ready

## 🚀 Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd mega-miyya
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
   - Choose your preferred AI provider (OpenAI, Ollama, or Hugging Face)
   - Follow the setup instructions in the [AI Provider Configuration](#ai-provider-configuration) section

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

1. **Webhook Trigger**: When a PR is created/updated, GitHub sends a webhook to `/api/webhooks/github`
2. **Repository Check**: The system verifies the repository is enabled for AI reviews
3. **Code Analysis**: Fetches PR files and generates an AI review using the configured provider
4. **GitHub Comment**: Posts the AI review as a comment on the PR
5. **Dashboard Update**: Stores review data for analytics and history

## API Endpoints

- `GET /api/auth/me` - Get current user session
- `POST /api/auth/logout` - Logout user
- `GET /api/repositories` - Fetch user's GitHub repositories
- `POST /api/repositories` - Update selected repositories
- `POST /api/webhooks/github` - GitHub webhook handler
- `GET /api/reviews` - Get review history
- `POST /api/github-app/installation-status` - Check GitHub App installation status
- `GET /api/github-app/cache-stats` - Get installation ID cache statistics
- `DELETE /api/github-app/cache-stats` - Clear all installation ID cache

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID | Yes |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret | Yes |
| `NEXTAUTH_SECRET` | NextAuth.js secret key | Yes |
| `NEXTAUTH_URL` | Application URL | Yes |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret for verification | Yes |
| `GITHUB_APP_ID` | GitHub App ID (for bot comments) | No |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key (for bot comments) | No |
| `GITHUB_APP_NAME` | GitHub App name for installation URLs (e.g., 'mega-miyya') | No |
| `AI_PROVIDER` | AI provider (openai/ollama/huggingface) | Yes |
| `OPENAI_API_KEY` | OpenAI API key | If using OpenAI |
| `OPENAI_MODEL` | OpenAI model name | If using OpenAI |
| `OLLAMA_URL` | Ollama server URL | If using Ollama |
| `OLLAMA_MODEL` | Ollama model name | If using Ollama |
| `HUGGINGFACE_API_KEY` | Hugging Face API key | If using Hugging Face |
| `HUGGINGFACE_PROVIDER` | Hugging Face provider | If using Hugging Face |
| `HUGGINGFACE_MODEL` | Hugging Face model name | If using Hugging Face |
| `DEFAULT_AI_PROVIDER` | Default AI provider for new users | No |

> **Note**: Installation IDs are now detected automatically for each repository. No need to configure `GITHUB_APP_INSTALLATION_ID`!

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

This project is licensed under the GNU Affero General Public License v3.0. This ensures that:
- Any derivative work must also be licensed under AGPL-3.0
- If you run this software on a server accessible to others, you must provide them access to the source code
- The software and its derivatives remain open source

For the complete license text, see [LICENSE](LICENSE) file or visit: https://www.gnu.org/licenses/agpl-3.0.txt

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
