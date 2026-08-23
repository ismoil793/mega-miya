import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hasValidRequestOrigin } from '@/lib/auth';
import { GitHubInstallationModel } from '@/models/GitHubInstallation';

const DEPTHS = new Set(['diff', 'changed-files', 'balanced', 'deep']);

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const owned = user.authorizedAccounts.filter((account) => account.role === 'owner');
  const installations = await GitHubInstallationModel.find({ accountId: { $in: owned.map((account) => account.githubAccountId) } })
    .select('accountId accountLogin accountType reviewSettings').lean();
  return NextResponse.json({ accounts: installations.map((installation) => ({
    githubAccountId: installation.accountId,
    login: installation.accountLogin,
    type: installation.accountType,
    contextDepth: installation.reviewSettings?.contextDepth || 'diff',
    autoApproveWhenResolved: Boolean(installation.reviewSettings?.autoApproveWhenResolved),
  })) });
}

export async function PUT(request: NextRequest) {
  if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const accountId = Number(body.githubAccountId);
  const contextDepth = String(body.contextDepth || '');
  const owned = user.authorizedAccounts.some((account) => account.githubAccountId === accountId && account.role === 'owner');
  if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!DEPTHS.has(contextDepth)) return NextResponse.json({ error: 'Invalid context depth' }, { status: 400 });
  const installation = await GitHubInstallationModel.findOneAndUpdate(
    { accountId, status: 'active' },
    { $set: {
      'reviewSettings.contextDepth': contextDepth,
      'reviewSettings.autoApproveWhenResolved': Boolean(body.autoApproveWhenResolved),
    } },
    { new: true },
  );
  if (!installation) return NextResponse.json({ error: 'GitHub App installation not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
