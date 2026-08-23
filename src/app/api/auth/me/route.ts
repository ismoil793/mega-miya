import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    
    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ 
      user: {
        id: user._id,
        githubId: user.githubId,
        githubUsername: user.githubUsername,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        repositories: user.repositories,
        settings: user.settings,
        createdAt: user.createdAt,
      }
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ user: null });
  }
}
