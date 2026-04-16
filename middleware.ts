import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth/constants';
import { verifySessionToken } from '@/lib/auth/jwt';
import { sanitizeNextPath } from '@/lib/auth/navigation';

function isPublicAsset(pathname: string): boolean {
  if (pathname.startsWith('/_next')) {
    return true;
  }

  if (pathname === '/favicon.ico' || pathname === '/robots.txt') {
    return true;
  }

  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

function isAuthRoute(pathname: string): boolean {
  return pathname === '/auth/login' || pathname === '/auth/register';
}

function buildLoginRedirect(request: NextRequest): NextResponse {
  const loginUrl = new URL('/auth/login', request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.searchParams.set('next', sanitizeNextPath(nextPath));
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicAsset(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const sessionUser = token ? await verifySessionToken(token) : null;

  if (!sessionUser) {
    if (isAuthRoute(pathname)) {
      return NextResponse.next();
    }

    return buildLoginRedirect(request);
  }

  if (isAuthRoute(pathname)) {
    const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get('next'));
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};