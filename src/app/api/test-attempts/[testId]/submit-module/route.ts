import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/auth/db';
import { authError } from '@/lib/auth/http';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { calculateOverallBand } from '@/lib/scoring';
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';
import type { ModuleScores, TestSessionFinalScores } from '@/lib/testing/types';
import { submitModuleSchema } from '@/lib/testing/validators';

export const runtime = 'nodejs';

type RouteParams = {
  testId: string;
};

type AttemptLookup = {
  _id: unknown;
  sessionId?: string;
  testId?: string;
  status: string;
  resultLocked?: boolean;
  moduleScores?: ModuleScores | null;
  moduleResults?: unknown;
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

export async function POST(
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return authError('INVALID_REQUEST', 'Invalid JSON payload.', 400);
  }

  const parsed = submitModuleSchema.safeParse(rawBody);
  if (!parsed.success) {
    return authError('VALIDATION_ERROR', 'Invalid submit module payload.', 400, parsed.error.flatten());
  }

  const { module, band, moduleResult } = parsed.data;

  try {
    await connectToDatabase();

    console.log('[submit-module] Looking up test attempt:', {
      sessionId: sessionIdFromRoute,
      studentId: sessionUser.id,
      module,
    });

    const attempt = await TestAttemptModel.findOne(
      buildSessionLookup(sessionIdFromRoute, sessionUser.id),
    ).lean<AttemptLookup>();

    if (!attempt) {
      console.error('[submit-module] Test attempt not found:', {
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

    console.log('[submit-module] Found attempt:', {
      attemptId: attempt._id,
      status: attempt.status,
      resultLocked: attempt.resultLocked,
      hasModuleScores: !!attempt.moduleScores,
    });

    // Guard: verify status === 'IN_PROGRESS' and resultLocked !== true
    if (attempt.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        {
          error: 'INVALID_STATUS',
          message: `Test attempt cannot accept module submissions with status ${attempt.status}.`,
        },
        { status: 400 },
      );
    }

    if (attempt.resultLocked === true) {
      return NextResponse.json(
        {
          error: 'ALREADY_FINALIZED',
          message: 'Test attempt results are locked and cannot be modified.',
        },
        { status: 400 },
      );
    }

    // Update via MongoDB dot-notation
    // Handle both new (initialized) and old (null) test attempts
    const updateOperation: Record<string, unknown> = {};

    // Check if we need to initialize moduleScores
    if (!attempt.moduleScores || attempt.moduleScores === null) {
      // Old test attempt or uninitialized - initialize the entire object
      updateOperation.moduleScores = {
        listening: module === 'listening' ? band : null,
        reading: module === 'reading' ? band : null,
        writing: module === 'writing' ? band : null,
        speaking: module === 'speaking' ? band : null,
        overall: null,
      };
    } else {
      // Existing test attempt - use dot notation
      updateOperation[`moduleScores.${module}`] = band;
    }

    // Always initialize moduleResults as an empty object if it's null, then set the field
    // This avoids the "Cannot create field in element {moduleResults: null}" error
    const needsModuleResultsInit = !attempt.moduleResults || attempt.moduleResults === null;

    if (needsModuleResultsInit) {
      // First, ensure moduleResults is an object
      updateOperation.moduleResults = {};
    }

    // Then set the specific module result (either as part of initial object or via dot notation)
    if (needsModuleResultsInit) {
      (updateOperation.moduleResults as Record<string, unknown>)[module] = moduleResult;
    } else {
      updateOperation[`moduleResults.${module}`] = moduleResult;
    }

    console.log('[submit-module] Performing update with operation:', {
      attemptId: attempt._id,
      hasExistingScores: !!attempt.moduleScores,
      updateOperation: JSON.stringify(updateOperation).substring(0, 500),
    });

    await TestAttemptModel.updateOne(
      {
        _id: attempt._id,
        studentId: sessionUser.id,
      },
      {
        $set: updateOperation,
      },
    );

    console.log('[submit-module] Update completed successfully');

    // Fetch updated document to check if all modules are complete
    const updatedAttempt = await TestAttemptModel.findOne({ _id: attempt._id }).lean<{
      _id: unknown;
      sessionId?: string;
      testId?: string;
      moduleScores?: ModuleScores | null;
    }>();

    if (!updatedAttempt) {
      return NextResponse.json(
        {
          error: 'SERVER_ERROR',
          message: 'Failed to retrieve updated test attempt.',
        },
        { status: 500 },
      );
    }

    const moduleScores = updatedAttempt.moduleScores;
    let status = 'IN_PROGRESS';

    // Check if all 4 module scores are non-null (test completed) and have values
    if (
      moduleScores &&
      moduleScores.listening !== null &&
      moduleScores.reading !== null &&
      moduleScores.writing !== null &&
      moduleScores.speaking !== null
    ) {
      // Calculate overall band
      const overall = calculateOverallBand([
        moduleScores.listening,
        moduleScores.reading,
        moduleScores.writing,
        moduleScores.speaking,
      ]);

      // Populate finalScores for backward compatibility
      const finalScores: TestSessionFinalScores = {
        listening: moduleScores.listening,
        reading: moduleScores.reading,
        writing: moduleScores.writing,
        speaking: moduleScores.speaking,
        overallBand: overall,
      };

      // Update: set overall, status, resultLocked, completedAt, finalScores
      await TestAttemptModel.updateOne(
        {
          _id: attempt._id,
          studentId: sessionUser.id,
        },
        {
          $set: {
            'moduleScores.overall': overall,
            status: 'COMPLETED',
            resultLocked: true,
            completedAt: new Date(),
            finalScores,
          },
        },
      );

      status = 'COMPLETED';

      // Return updated moduleScores with overall
      return NextResponse.json({
        success: true,
        moduleScores: {
          ...moduleScores,
          overall,
        },
        status,
      });
    }

    // Return current moduleScores without overall
    return NextResponse.json({
      success: true,
      moduleScores: moduleScores ?? {
        listening: null,
        reading: null,
        writing: null,
        speaking: null,
        overall: null,
      },
      status,
    });
  } catch (error) {
    console.error('[submit-module] Server error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      sessionId: sessionIdFromRoute,
      module,
      band,
    });
    return authError(
      'SERVER_ERROR',
      'Failed to submit module score.',
      500,
      error instanceof Error ? error.message : undefined,
    );
  }
}
