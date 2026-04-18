import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/auth/db';
import { authError } from '@/lib/auth/http';
import { hashPassword } from '@/lib/auth/password';
import { attachSessionCookie } from '@/lib/auth/session';
import { toPublicStudent, toSessionUser } from '@/lib/auth/student-mappers';
import { StudentModel } from '@/lib/auth/student-model';
import { normalizeEmail, normalizeRegisterNumber } from '@/lib/auth/types';
import { registerSchema } from '@/lib/auth/validators';

export const runtime = 'nodejs';

type MongoDuplicateKeyError = {
  code?: unknown;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
};

function isMongoDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return 'code' in error && (error as { code?: unknown }).code === 11000;
}

function resolveDuplicateField(error: MongoDuplicateKeyError): 'registerNumber' | 'email' | null {
  if (error.keyPattern && typeof error.keyPattern === 'object') {
    if ('registerNumber' in error.keyPattern) {
      return 'registerNumber';
    }

    if ('email' in error.keyPattern) {
      return 'email';
    }
  }

  if (error.keyValue && typeof error.keyValue === 'object') {
    if ('registerNumber' in error.keyValue) {
      return 'registerNumber';
    }

    if ('email' in error.keyValue) {
      return 'email';
    }
  }

  return null;
}

function isAuthInfrastructureError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return ['MONGODB_URI', 'MONGODB_DB_NAME', 'JWT_SECRET'].some((needle) => error.message.includes(needle));
}

function logRegisterError(error: unknown): void {
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  const errorMessage = error instanceof Error ? error.message : String(error);

  console.error('[auth/register] Failed to create account', {
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

  let input: z.infer<typeof registerSchema>;
  try {
    input = registerSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return authError('VALIDATION_ERROR', 'Please fix the highlighted fields.', 400, error.flatten());
    }

    return authError('INVALID_REQUEST', 'Invalid request body.', 400);
  }

  try {
    await connectToDatabase();

    const registerNumber = normalizeRegisterNumber(input.registerNumber);
    const email = normalizeEmail(input.email);

    const [registerMatch, emailMatch] = await Promise.all([
      StudentModel.findOne({ registerNumber }).lean(),
      StudentModel.findOne({ email }).lean(),
    ]);

    if (registerMatch) {
      return authError('CONFLICT', 'Register number already exists.', 409);
    }

    if (emailMatch) {
      return authError('CONFLICT', 'Email already exists.', 409);
    }

    const passwordHash = await hashPassword(input.password);
    const createdStudent = await StudentModel.create({
      fullName: input.fullName.trim(),
      registerNumber,
      email,
      passwordHash,
    });

    const sessionUser = toSessionUser(createdStudent);
    const response = NextResponse.json({
      user: toPublicStudent(createdStudent),
    });

    await attachSessionCookie(response, sessionUser);
    return response;
  } catch (error) {
    if (isMongoDuplicateKeyError(error)) {
      const duplicateField = resolveDuplicateField(error);

      if (duplicateField === 'registerNumber') {
        return authError('CONFLICT', 'Register number already exists.', 409);
      }

      if (duplicateField === 'email') {
        return authError('CONFLICT', 'Email already exists.', 409);
      }

      return authError('CONFLICT', 'Account already exists.', 409);
    }

    logRegisterError(error);

    if (isAuthInfrastructureError(error)) {
      return authError('SERVER_ERROR', 'Registration is unavailable due to server configuration.', 500);
    }

    return authError('SERVER_ERROR', 'Failed to create account.', 500);
  }
}