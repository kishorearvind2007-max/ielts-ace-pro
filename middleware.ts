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

function isLandingRoute(pathname: string): boolean {
  return pathname === '/';
}

function isPublicApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/certificates/verify/')
    || pathname === '/api/certificates/sample';
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

  if (pathname.startsWith('/api/auth') || isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const sessionUser = token ? await verifySessionToken(token) : null;

  if (!sessionUser) {
    if (isAuthRoute(pathname) || isLandingRoute(pathname)) {
      return NextResponse.next();
    }

    return buildLoginRedirect(request);
  }

  if (isAuthRoute(pathname)) {
    const requestedNextPath = sanitizeNextPath(request.nextUrl.searchParams.get('next'));
    const nextPath = requestedNextPath === '/' ? '/dashboard' : requestedNextPath;
    return NextResponse.redirect(new URL(nextPath, request.url));
  }

  if (isLandingRoute(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};