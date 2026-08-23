import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/models/User';
import { GitHubInstallationModel } from '@/models/GitHubInstallation';
import { getAuthenticatedUser, hasValidRequestOrigin } from '@/lib/auth';

async function installedRepositoriesForUser(user: Awaited<ReturnType<typeof getAuthenticatedUser>>) {
  if (!user) return [];
  const administratedAccountIds = user.authorizedAccounts
    .filter((account) => account.role === 'owner')
    .map((account) => account.githubAccountId);

  const installations = await GitHubInstallationModel.find({
    accountId: { $in: administratedAccountIds },
    status: 'active',
  }).lean();

  const byId = new Map<number, any>();
  for (const installation of installations) {
    for (const repository of installation.repositories) {
      byId.set(repository.githubRepositoryId, repository);
    }
  }
  return Array.from(byId.values());
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const repositories = await installedRepositoriesForUser(user);
    const responseRepositories = repositories.map((repository) => ({
      id: repository.githubRepositoryId,
      name: repository.name,
      fullName: repository.fullName,
      description: null,
      private: repository.private,
      language: null,
      stars: 0,
      updatedAt: null,
      isEnabled: user.repositories.includes(repository.fullName),
      hasGitHubApp: true,
    }));

    return NextResponse.json({
      repositories: responseRepositories,
      selectedRepositories: user.repositories.filter((name) =>
        repositories.some((repository) => repository.fullName === name),
      ),
      githubAppInstallUrl: `https://github.com/apps/${process.env.GITHUB_APP_NAME || 'mega-miyya'}/installations/new`,
    });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasValidRequestOrigin(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }

    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { repositories } = await request.json();
    if (!Array.isArray(repositories)) {
      return NextResponse.json({ error: 'Invalid repositories data' }, { status: 400 });
    }

    const installedRepositories = await installedRepositoriesForUser(user);
    const allowedNames = new Set(installedRepositories.map((repository) => repository.fullName));
    if (repositories.some((repository) => typeof repository !== 'string' || !allowedNames.has(repository))) {
      return NextResponse.json({ error: 'One or more repositories are not authorized' }, { status: 403 });
    }

    const updatedUser = await UserModel.findByIdAndUpdate(user._id, { repositories }, { new: true });
    if (!updatedUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({ success: true, repositories: updatedUser.repositories });
  } catch (error) {
    console.error('Error updating repositories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
