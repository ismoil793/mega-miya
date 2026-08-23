import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, destroySession, hasValidRequestOrigin } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!hasValidRequestOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  await destroySession(request);
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response);
  return response;
}
