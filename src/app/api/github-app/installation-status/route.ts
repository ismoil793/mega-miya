import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';
import { GitHubInstallationModel } from '@/models/GitHubInstallation';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { repositories } = await request.json();

    if (!Array.isArray(repositories)) {
      return NextResponse.json({ error: 'Invalid repositories data' }, { status: 400 });
    }
    if (repositories.some((repository) => typeof repository !== 'string' || !user.repositories.includes(repository))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const accountIds = user.authorizedAccounts.map((account) => account.githubAccountId);
    const records = await GitHubInstallationModel.find({
      accountId: { $in: accountIds },
      status: 'active',
      'repositories.fullName': { $in: repositories },
    }).lean();
    const installedNames = new Set(records.flatMap((record) =>
      record.repositories.map((repo: { fullName: string }) => repo.fullName),
    ));
    const installations = Object.fromEntries(
      repositories.map((repository) => [repository, installedNames.has(repository)]),
    );

    return NextResponse.json({ 
      installations,
      appName: process.env.GITHUB_APP_NAME || 'mega-miyya',
      message: 'Installation status checked successfully'
    });

  } catch (error) {
    console.error('Error checking installation status:', error);
    return NextResponse.json({ 
      error: 'Failed to check installation status' 
    }, { status: 500 });
  }
}
