import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/auth/db';
import { authError } from '@/lib/auth/http';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';

export const runtime = 'nodejs';

type RouteParams = {
  testId: string;
};

function buildSessionLookup(sessionId: string, studentId: string) {
  return {
    studentId,
    $or: [
      { sessionId },
      { testId: sessionId },
    ],
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> },
) {
  const sessionUser = await getSessionUserFromRequest(request);
  if (!sessionUser) {
    return authError('UNAUTHORIZED', 'Not authenticated.', 401);
  }

  const { testId: rawSessionId } = await context.params;
  const sessionIdFromRoute = rawSessionId?.trim();
  
  if (!sessionIdFromRoute) {
    return authError('INVALID_REQUEST', 'Missing testId route parameter.', 400);
  }

  try {
    await connectToDatabase();

    console.log('[test-attempt GET] Fetching test attempt:', {
      sessionId: sessionIdFromRoute,
      studentId: sessionUser.id,
    });

    const attempt = await TestAttemptModel.findOne(
      buildSessionLookup(sessionIdFromRoute, sessionUser.id),
    ).lean();

    if (!attempt) {
      console.error('[test-attempt GET] Test attempt not found:', {
        sessionId: sessionIdFromRoute,
        studentId: sessionUser.id,
      });
      return NextResponse.json(
        {
          error: 'NOT_FOUND',
          message: 'Test attempt not found for this user.',
        },
        { status: 404 },
      );
    }

    console.log('[test-attempt GET] Found attempt:', {
      attemptId: attempt._id,
      status: attempt.status,
      moduleScores: attempt.moduleScores,
    });

    return NextResponse.json({
      success: true,
      attempt,
    });
  } catch (error) {
    console.error('[test-attempt GET] Server error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      sessionId: sessionIdFromRoute,
    });
    return authError(
      'SERVER_ERROR',
      'Failed to fetch test attempt.',
      500,
      error instanceof Error ? error.message : undefined,
    );
  }
}
