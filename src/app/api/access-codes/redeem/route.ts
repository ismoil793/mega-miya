import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_CODE_RESERVATION_COOKIE, ACCESS_CODE_RESERVATION_SECONDS, accessCodesRequired, reserveAccessCode } from '@/lib/access-codes';
import { hasValidRequestOrigin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    if (!accessCodesRequired()) return NextResponse.json({ error: 'Access codes are disabled.' }, { status: 404 });
    if (!hasValidRequestOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 2_000) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    const body = await request.json();
    const reservationToken = await reserveAccessCode(String(body.code || ''));
    if (!reservationToken) {
      const response = NextResponse.json({ error: 'This access code is invalid, expired, or already used.' }, { status: 400 });
      response.cookies.delete(ACCESS_CODE_RESERVATION_COOKIE);
      return response;
    }
    const response = NextResponse.json({ success: true, authorizationUrl: '/api/auth/github' });
    response.cookies.set(ACCESS_CODE_RESERVATION_COOKIE, reservationToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: ACCESS_CODE_RESERVATION_SECONDS,
    });
    return response;
  } catch (error) {
    console.error('Access-code reservation failed:', error);
    return NextResponse.json({ error: 'Could not validate the access code.' }, { status: 500 });
  }
}
