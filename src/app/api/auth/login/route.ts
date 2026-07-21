import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/auth/db';
import { DEMO_USER, isDemoCredentialInput } from '@/lib/auth/demo-user';
import { authError } from '@/lib/auth/http';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { attachSessionCookie } from '@/lib/auth/session';
import { toPublicStudent, toSessionUser } from '@/lib/auth/student-mappers';
import { StudentModel } from '@/lib/auth/student-model';
import { normalizeEmail, normalizeRegisterNumber } from '@/lib/auth/types';
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

async function ensureDemoStudent() {
  const registerNumber = normalizeRegisterNumber(DEMO_USER.registerNumber);
  const email = normalizeEmail(DEMO_USER.email);
  const passwordHash = await hashPassword(DEMO_USER.password);

  const existingStudent = await StudentModel.findOne({ registerNumber });
  if (existingStudent) {
    existingStudent.fullName = DEMO_USER.fullName;
    existingStudent.email = email;
    existingStudent.passwordHash = passwordHash;
    await existingStudent.save();
    return existingStudent;
  }

  return StudentModel.create({
    fullName: DEMO_USER.fullName,
    registerNumber,
    email,
    passwordHash,
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
    if (isDemoCredentialInput(registerNumber, input.password)) {
      const demoStudent = await ensureDemoStudent();

      const response = NextResponse.json({
        user: toPublicStudent(demoStudent),
      });

      await attachSessionCookie(response, toSessionUser(demoStudent));
      return response;
    }

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