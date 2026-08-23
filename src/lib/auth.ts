import { randomBytes } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/database';
import { SessionModel } from '@/models/Session';
import { UserModel, type UserDocument } from '@/models/User';
import { hashSessionToken } from '@/lib/auth-crypto';

export const SESSION_COOKIE = 'session_token';
export const OAUTH_STATE_COOKIE = 'oauth_state';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export async function createSession(userId: string): Promise<string> {
  await connectDB();
  const token = randomBytes(32).toString('base64url');
  await SessionModel.create({
    tokenHash: hashSessionToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
  });
  return token;
}

export async function getAuthenticatedUser(request: NextRequest): Promise<UserDocument | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  await connectDB();
  const session = await SessionModel.findOne({
    tokenHash: hashSessionToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return null;

  return UserModel.findById(session.userId);
}

export async function destroySession(request: NextRequest): Promise<void> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await connectDB();
  await SessionModel.deleteOne({ tokenHash: hashSessionToken(token) });
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export function hasValidRequestOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const configuredAppUrl = process.env.NEXTAUTH_URL;
    if (configuredAppUrl) return new URL(origin).origin === new URL(configuredAppUrl).origin;

    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const expectedOrigin = forwardedHost
      ? `${forwardedProto || 'https'}://${forwardedHost}`
      : request.nextUrl.origin;
    return new URL(origin).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}
