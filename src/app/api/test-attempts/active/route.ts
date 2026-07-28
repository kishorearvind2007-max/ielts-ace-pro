import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/auth/db';
import { authError } from '@/lib/auth/http';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { StudentModel } from '@/lib/auth/student-model';
import type { SessionUser } from '@/lib/auth/types';
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';
import type { ModuleScores, FinalizedAttemptResult } from '@/lib/testing/types';

export const runtime = 'nodejs';

async function resolveSessionStudent(sessionUser: SessionUser) {
  const studentFromSubject = await StudentModel.findById(sessionUser.id).lean();

  if (studentFromSubject) {
    return studentFromSubject;
  }

  const normalizedRegisterNumber = sessionUser.registerNumber;
  if (!normalizedRegisterNumber) {
    return null;
  }

  return StudentModel.findOne({ registerNumber: normalizedRegisterNumber }).lean();
}

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request);
  if (!sessionUser) {
    return authError('UNAUTHORIZED', 'Not authenticated.', 401);
  }

  try {
    await connectToDatabase();

    const student = await resolveSessionStudent(sessionUser);
    if (!student) {
      return authError('UNAUTHORIZED', 'Session is no longer valid.', 401);
    }

    // Query for the most recent active attempt (IN_PROGRESS or COMPLETED with resultLocked)
    const activeAttempt = await TestAttemptModel.findOne({
      studentId: student._id,
      $or: [
        { status: 'IN_PROGRESS' },
        { status: 'COMPLETED', resultLocked: true },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!activeAttempt) {
      return NextResponse.json({
        sessionId: null,
        moduleScores: null,
      });
    }

    // Return the active attempt with moduleScores and moduleResults
    return NextResponse.json({
      sessionId: activeAttempt.sessionId,
      status: activeAttempt.status,
      moduleScores: activeAttempt.moduleScores as ModuleScores | null,
      moduleResults: activeAttempt.moduleResults as Partial<FinalizedAttemptResult> | undefined,
    });
  } catch (error) {
    return authError(
      'SERVER_ERROR',
      'Failed to retrieve active attempt.',
      500,
      error instanceof Error ? error.message : undefined,
    );
  }
}
