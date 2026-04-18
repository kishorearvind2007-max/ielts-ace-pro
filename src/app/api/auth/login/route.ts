import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/auth/db';
import { authError } from '@/lib/auth/http';
import { verifyPassword } from '@/lib/auth/password';
import { attachSessionCookie } from '@/lib/auth/session';
import { toPublicStudent, toSessionUser } from '@/lib/auth/student-mappers';
import { StudentModel } from '@/lib/auth/student-model';
import { normalizeRegisterNumber } from '@/lib/auth/types';
import { loginSchema } from '@/lib/auth/validators';

export const runtime = 'nodejs';

function isAuthInfrastructureError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return ['MONGODB_URI', 'MONGODB_DB_NAME', 'JWT_SECRET'].some((needle) => error.message.includes(needle));
}

function logLoginError(error: unknown): void {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  const errorMessage = error instanceof Error ? error.message : String(error);

  console.error('[auth/login] Failed to login', {
    errorName,
    errorMessage,
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return authError('INVALID_REQUEST', 'Invalid JSON payload.', 400);
  }

  let input: z.infer<typeof loginSchema>;
  try {
    input = loginSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return authError('VALIDATION_ERROR', 'Please provide register number and password.', 400, error.flatten());
    }

    return authError('INVALID_REQUEST', 'Invalid request body.', 400);
  }

  try {
    await connectToDatabase();

    const registerNumber = normalizeRegisterNumber(input.registerNumber);
    const student = await StudentModel.findOne({ registerNumber });

    if (!student) {
      return authError('INVALID_CREDENTIALS', 'Invalid register number or password.', 401);
    }

    // Legacy or externally-seeded records can miss a usable bcrypt hash.
    if (typeof student.passwordHash !== 'string' || student.passwordHash.length === 0) {
      return authError('INVALID_CREDENTIALS', 'Invalid register number or password.', 401);
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await verifyPassword(input.password, student.passwordHash);
    } catch {
      return authError('INVALID_CREDENTIALS', 'Invalid register number or password.', 401);
    }

    if (!isPasswordValid) {
      return authError('INVALID_CREDENTIALS', 'Invalid register number or password.', 401);
    }

    const response = NextResponse.json({
      user: toPublicStudent(student),
    });

    await attachSessionCookie(response, toSessionUser(student));
    return response;
  } catch (error) {
    logLoginError(error);

    if (isAuthInfrastructureError(error)) {
      return authError('SERVER_ERROR', 'Login is unavailable due to server configuration.', 500);
    }

    return authError('SERVER_ERROR', 'Failed to login.', 500);
  }
}