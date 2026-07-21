import type { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/constants';
import { signSessionToken, verifySessionToken } from '@/lib/auth/jwt';
import type { SessionUser } from '@/lib/auth/types';

const isSecureEnv = process.env.NODE_ENV === 'production';

export async function attachSessionCookie(response: NextResponse, user: SessionUser): Promise<void> {
  const token = await signSessionToken(user);
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getSessionUserFromRequest(request: NextRequest): Promise<SessionUser | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}