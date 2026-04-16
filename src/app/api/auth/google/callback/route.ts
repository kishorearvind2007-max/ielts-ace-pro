import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/auth/db';
import {
  exchangeGoogleCodeForIdToken,
  sanitizeNextPath,
  verifyGoogleIdToken,
} from '@/lib/auth/google';
import {
  OAUTH_NEXT_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
} from '@/lib/auth/constants';
import { attachSessionCookie } from '@/lib/auth/session';
import { toSessionUser } from '@/lib/auth/student-mappers';
import { StudentModel } from '@/lib/auth/student-model';
import { normalizeEmail } from '@/lib/auth/types';

const isSecureEnv = process.env.NODE_ENV === 'production';

export const runtime = 'nodejs';

function clearOAuthCookies(response: NextResponse): void {
  response.cookies.set({
    name: OAUTH_STATE_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  response.cookies.set({
    name: OAUTH_NEXT_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

function loginErrorRedirect(request: NextRequest, code: string): NextResponse {
  const url = new URL('/auth/login', request.url);
  url.searchParams.set('error', code);
  const response = NextResponse.redirect(url);
  clearOAuthCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  const receivedState = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');
  const storedState = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;
  const encodedNext = request.cookies.get(OAUTH_NEXT_COOKIE_NAME)?.value;
  const decodedNext = encodedNext ? decodeURIComponent(encodedNext) : '/';
  const nextPath = sanitizeNextPath(decodedNext);

  if (!receivedState || !storedState || receivedState !== storedState) {
    return loginErrorRedirect(request, 'oauth_state_mismatch');
  }

  if (!code) {
    return loginErrorRedirect(request, 'oauth_code_missing');
  }

  try {
    const idToken = await exchangeGoogleCodeForIdToken(code);
    const googleIdentity = await verifyGoogleIdToken(idToken);

    if (!googleIdentity.emailVerified) {
      return loginErrorRedirect(request, 'google_email_not_verified');
    }

    await connectToDatabase();
    const email = normalizeEmail(googleIdentity.email);
    const student = await StudentModel.findOne({ email });

    // Google login is only allowed after account creation via register number + password.
    if (!student) {
      return loginErrorRedirect(request, 'account_not_found');
    }

    if (student.googleSub && student.googleSub !== googleIdentity.sub) {
      return loginErrorRedirect(request, 'google_account_mismatch');
    }

    if (!student.googleSub) {
      student.googleSub = googleIdentity.sub;
      await student.save();
    }

    const response = NextResponse.redirect(new URL(nextPath, request.url));
    await attachSessionCookie(response, toSessionUser(student));
    clearOAuthCookies(response);
    return response;
  } catch {
    return loginErrorRedirect(request, 'oauth_failed');
  }
}