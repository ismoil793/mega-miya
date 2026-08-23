# GitHub App Setup Guide

This guide will help you set up a GitHub App so that AI review comments are posted under the bot's name instead of your personal account.

## 🎯 Why GitHub App?

- **Bot Identity**: Comments appear under the bot's name (e.g., "mega-miya-bot commented")
- **Professional Appearance**: Clear separation between human and AI comments
- **Better UX**: Users know immediately it's an automated review
- **Dynamic Installation**: Automatically detects installation IDs for each repository

## 🚀 Quick Setup

### 1. Create GitHub App

1. Go to [GitHub Settings > Developer settings > GitHub Apps](https://github.com/settings/apps)
2. Click "New GitHub App"
3. Fill in the details:

```
App name: mega-miya
Description: AI-powered code review bot
Homepage URL: http://localhost:3004
Webhook URL: http://localhost:3004/api/webhooks/github
Webhook secret: [use the same as GITHUB_WEBHOOK_SECRET]
```

**Important:** The webhook URL is configured at the GitHub App level and will automatically receive events for all repositories where the app is installed. No need to configure webhooks per repository!

### 2. Set Permissions

**Repository permissions:**
- `Issues`: Read & Write (for commenting on PRs)
- `Pull requests`: Read & Write (for reading PR data)
- `Contents`: Read (for reading code files)
- `Metadata`: Read (for repository info)

**Subscribe to events:**
- `Pull requests`
- `Pull request review threads` (required for approval after findings are resolved)
- `Installation`
- `Installation repositories`

### 3. Install the App

1. After creating, click "Install App"
2. Choose which repositories to install it on
3. **No need to note the Installation ID** - the app will detect it automatically!

### 4. Generate Private Key

1. In your GitHub App settings, click "Generate private key"
2. Download the `.pem` file
3. Convert it to a single line for environment variable:

```bash
# Convert the .pem file to a single line
cat your-app.private-key.pem | tr '\n' '\\n'
```

### 5. Configure Environment Variables

Add these to your `.env.local`:

```env
# GitHub App Configuration (for bot comments)
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
GITHUB_APP_NAME=mega-miya
# GITHUB_APP_INSTALLATION_ID is no longer needed - detected automatically!
```

## 🔧 How It Works

### Current flow (OAuth + GitHub App)

1. OAuth signs the user into the dashboard and establishes which GitHub accounts they may administer. OAuth repository tokens are not stored.
2. The GitHub App installation grants repository access and sends signed webhooks.
3. Mega-Miya creates a short-lived installation token to read the reviewed commit and post comments or approvals as the bot.
4. Account owners configure their own LLM credential and review behavior in the dashboard.

There is no personal-token fallback for repository reads or review writes. If the GitHub App is unavailable or lacks permission, the review fails closed.

## 🧪 Testing

### 1. Check Configuration

The app will log the GitHub App configuration:

```
🤖 Using GitHub App for bot comments...
🔧 GitHub App config: { appId: 'configured', privateKey: 'configured' }
✅ Got installation token for owner/repo
✅ Bot comment posted to PR #5 in username/repo
```

### 2. Test automatic approval

Enable **Pull request review threads** in both development and production GitHub Apps. Turn on automatic approval in **Review behavior**, open a PR that produces an inline finding, and resolve its final Mega-Miya thread. The approval applies only when the reviewed head SHA is still current.

## 🔍 Troubleshooting

### Common Issues

1. **"GitHub App ID or Private Key not configured"**
   - Check that `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` are set
   - Make sure the private key is properly formatted with `\n` for newlines

2. **"Failed to get installation ID"**
   - Check that the app is installed on the repository
   - Ensure the app has the required permissions
   - Verify the repository owner has granted access to the app

3. **Review-thread resolution does not approve**
   - Enable the **Pull request review threads** webhook subscription
   - Verify **Pull requests: Read & write** permission
   - Confirm automatic approval is enabled for the installed GitHub account
   - Confirm no newer commit was pushed after Mega-Miya reviewed the PR

### Debug Commands

```bash
# Check if GitHub App is configured
node -e "const { githubAppService } = require('./src/lib/github-app'); console.log(githubAppService.getConfig());"

# Test JWT generation
node -e "const { githubAppService } = require('./src/lib/github-app'); console.log(githubAppService.isConfigured());"

# List all installations for your app
node find-installation-id.js
```

## 🎯 Benefits

- **Professional Appearance**: Comments clearly marked as AI-generated
- **User Experience**: No confusion about who posted the comment
- **Scalability**: Can handle multiple repositories with different installations
- **Reliability**: Fallback to personal token if GitHub App fails
- **Dynamic Detection**: No need to manage installation IDs manually
- **Future-Proof**: Works even if app is reinstalled or moved to different repos

## 🔄 Migration

Repository review requires the GitHub App. OAuth remains a separate identity-only integration for dashboard sign-in.

## 📚 Resources

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [GitHub App Permissions](https://docs.github.com/en/apps/creating-github-apps/setting-up-a-github-app/creating-a-github-app#choosing-permissions)
- [Installation Tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)

**That's it!** Your AI code review tool will now post comments under the bot's name while maintaining all existing functionality.
