import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  OAUTH_NEXT_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_MAX_AGE_SECONDS,
} from '@/lib/auth/constants';
import { buildGoogleAuthorizeUrl, createOAuthState, sanitizeNextPath } from '@/lib/auth/google';

const isSecureEnv = process.env.NODE_ENV === 'production';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const requestedNext = sanitizeNextPath(request.nextUrl.searchParams.get('next'));
  const state = createOAuthState();
  const redirectTarget = buildGoogleAuthorizeUrl(state);

  const response = NextResponse.redirect(redirectTarget);
  response.cookies.set({
    name: OAUTH_STATE_COOKIE_NAME,
    value: state,
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: 'lax',
    path: '/',
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });
  response.cookies.set({
    name: OAUTH_NEXT_COOKIE_NAME,
    value: encodeURIComponent(requestedNext),
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: 'lax',
    path: '/',
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  return response;
}