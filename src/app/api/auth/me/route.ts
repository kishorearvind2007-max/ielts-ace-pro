import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/auth/db';
import { authError } from '@/lib/auth/http';
import { clearSessionCookie, getSessionUserFromRequest } from '@/lib/auth/session';
import { toPublicStudent } from '@/lib/auth/student-mappers';
import { StudentModel } from '@/lib/auth/student-model';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request);
  if (!sessionUser) {
    return authError('UNAUTHORIZED', 'Not authenticated.', 401);
  }

  try {
    await connectToDatabase();
    const student = await StudentModel.findById(sessionUser.id).lean();

    if (!student) {
      const response = authError('UNAUTHORIZED', 'Session is no longer valid.', 401);
      clearSessionCookie(response);
      return response;
    }

    return NextResponse.json({
      user: toPublicStudent(student),
    });
  } catch (error) {
    return authError('SERVER_ERROR', 'Failed to fetch current user.', 500, error instanceof Error ? error.message : undefined);
  }
}