import { NextResponse } from 'next/server';

export type AuthErrorCode =
  | 'INVALID_REQUEST'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHORIZED'
  | 'ACCOUNT_NOT_FOUND'
  | 'OAUTH_ERROR'
  | 'SERVER_ERROR';

export function authError(
  code: AuthErrorCode,
  message: string,
  status: number,
  details?: unknown,
) {
  const includeDetails =
    details !== undefined && (code !== 'SERVER_ERROR' || process.env.NODE_ENV !== 'production');

  return NextResponse.json(
    {
      error: code,
      message,
      ...(includeDetails ? { details } : {}),
    },
    { status },
  );
}