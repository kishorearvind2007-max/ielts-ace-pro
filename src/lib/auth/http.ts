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
  return NextResponse.json(
    {
      error: code,
      message,
      details,
    },
    { status },
  );
}