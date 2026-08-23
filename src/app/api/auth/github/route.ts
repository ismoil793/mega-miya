import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { OAUTH_STATE_COOKIE } from '@/lib/auth';

export async function GET(_request: NextRequest) {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback`;
    
    if (!clientId || !process.env.NEXTAUTH_URL) {
      return NextResponse.json(
        { error: 'GitHub OAuth not configured' },
        { status: 500 }
      );
    }

    // Generate a random state parameter for security
    const state = randomBytes(32).toString('base64url');
    
    // Store state in a cookie for verification
    const response = NextResponse.redirect(
      `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('read:user user:email read:org')}&state=${state}`
    );
    
    // Set state cookie
    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10, // 10 minutes
    });

    return response;
  } catch (error) {
    console.error('GitHub OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate GitHub OAuth' },
      { status: 500 }
    );
  }
}
