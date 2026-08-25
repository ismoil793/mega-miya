import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/database';
import { UserModel } from '@/models/User';
import {
  createSession,
  OAUTH_STATE_COOKIE,
  setSessionCookie,
} from '@/lib/auth';
import { secureEqual } from '@/lib/auth-crypto';
import {
  ACCESS_CODE_RESERVATION_COOKIE,
  bindAccessCodeToUser,
  consumeAccessCodeReservation,
} from '@/lib/access-codes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const returnedState = searchParams.get('state');
    const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(new URL('/?error=oauth_failed', request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/?error=no_code', request.url));
    }

    if (!returnedState || !expectedState || !secureEqual(returnedState, expectedState)) {
      console.error('OAuth state validation failed');
      const response = NextResponse.redirect(new URL('/?error=invalid_state', request.url));
      response.cookies.delete(OAUTH_STATE_COOKIE);
      return response;
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Token exchange error:', tokenData);
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
    }

    const accessToken = tokenData.access_token;

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error('GitHub API error:', userData);
      return NextResponse.redirect(new URL('/?error=github_api_failed', request.url));
    }

    const membershipsResponse = await fetch('https://api.github.com/user/memberships/orgs?state=active&per_page=100', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!membershipsResponse.ok) {
      console.error('GitHub organization membership request failed:', membershipsResponse.status);
      return NextResponse.redirect(new URL('/?error=github_memberships_failed', request.url));
    }
    const memberships = await membershipsResponse.json();
    const authorizedAccounts = [
      {
        githubAccountId: userData.id,
        login: userData.login,
        type: 'User' as const,
        role: 'owner' as const,
      },
      ...memberships.map((membership: any) => ({
        githubAccountId: membership.organization.id,
        login: membership.organization.login,
        type: 'Organization' as const,
        role: membership.role === 'admin' ? 'owner' as const : 'member' as const,
      })),
    ];

    // Connect to database
    await connectDB();

    // Find or create user
    let user = await UserModel.findOne({ githubId: userData.id });

    if (!user) {
      const reservationToken = request.cookies.get(ACCESS_CODE_RESERVATION_COOKIE)?.value || '';
      const accessCodeId = await consumeAccessCodeReservation(reservationToken, userData.id);
      if (!accessCodeId) {
        const response = NextResponse.redirect(new URL('/?error=access_code_required', request.url));
        response.cookies.delete(OAUTH_STATE_COOKIE);
        response.cookies.delete(ACCESS_CODE_RESERVATION_COOKIE);
        return response;
      }
      // Create new user
      user = new UserModel({
        githubId: userData.id,
        githubUsername: userData.login,
        email: userData.email,
        name: userData.name,
        avatarUrl: userData.avatar_url,
        authorizedAccounts,
        repositories: [],
        invitedByAccessCodeId: accessCodeId,
        settings: {
          aiProvider: process.env.DEFAULT_AI_PROVIDER || 'openai',
          autoReview: true,
          reviewScope: 'all',
        },
      });
    } else {
      user.githubUsername = userData.login;
      user.email = userData.email;
      user.name = userData.name;
      user.avatarUrl = userData.avatar_url;
      user.authorizedAccounts = authorizedAccounts;
    }

    user.accessToken = undefined;

    await user.save();
    if (user.invitedByAccessCodeId) {
      await bindAccessCodeToUser(user.invitedByAccessCodeId, user._id);
    }
    await UserModel.updateOne({ _id: user._id }, { $unset: { accessToken: 1 } });

    const sessionToken = await createSession(user._id.toString());

    // Redirect to dashboard with success status
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('success', 'connected');

    const response = NextResponse.redirect(redirectUrl);
    
    // Set session cookie
    setSessionCookie(response, sessionToken);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    response.cookies.delete(ACCESS_CODE_RESERVATION_COOKIE);

    return response;

  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(new URL('/?error=server_error', request.url));
  }
}
