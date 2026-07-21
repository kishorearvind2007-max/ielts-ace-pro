import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/auth/db';
import { authError } from '@/lib/auth/http';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { finalizeAttemptFromSubmissions } from '@/lib/testing/finalize-service';
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';
import type { AttemptModuleContent, AttemptSubmissionPayload, TestSessionFinalScores } from '@/lib/testing/types';
import { finalizeAttemptSchema, toNumericAnswerMap } from '@/lib/testing/validators';

export const runtime = 'nodejs';

type RouteParams = {
  testId: string;
};

type AttemptLookup = {
  _id: unknown;
  sessionId?: string;
  testId?: string;
  status: string;
  modules: AttemptModuleContent;
  completedAt?: Date;
  moduleResults?: unknown;
  finalScores?: TestSessionFinalScores;
  resultLocked?: boolean;
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

function buildSubmissionPayload(input: {
  listeningAnswers: Record<string, string>;
  readingAnswers: Record<string, string>;
  writingResponses: { task1: string; task2: string };
  speakingTranscripts: { part1: string; part2: string; part3: string };
}): AttemptSubmissionPayload {
  return {
    listeningAnswers: toNumericAnswerMap(input.listeningAnswers),
    readingAnswers: toNumericAnswerMap(input.readingAnswers),
    writingResponses: {
      task1: input.writingResponses.task1.trim(),
      task2: input.writingResponses.task2.trim(),
    },
    speakingTranscripts: {
      part1: input.speakingTranscripts.part1.trim(),
      part2: input.speakingTranscripts.part2.trim(),
      part3: input.speakingTranscripts.part3.trim(),
    },
  };
}

function formatResultPayload(result: {
  sessionId: string;
  completedAt?: Date;
  moduleResults: unknown;
  finalScores: TestSessionFinalScores;
}) {
  return {
    sessionId: result.sessionId,
    testId: result.sessionId,
    overallBand: result.finalScores.overallBand,
    completedAt: result.completedAt ?? null,
    finalScores: result.finalScores,
    modules: result.moduleResults,
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

  const parsed = finalizeAttemptSchema.safeParse(rawBody);
  if (!parsed.success) {
    return authError('VALIDATION_ERROR', 'Invalid finalize payload.', 400, parsed.error.flatten());
  }

  try {
    await connectToDatabase();

    const attempt = await TestAttemptModel.findOne(
      buildSessionLookup(sessionIdFromRoute, sessionUser.id),
    ).lean<AttemptLookup>();

    if (!attempt) {
      return NextResponse.json(
        {
          error: 'NOT_FOUND',
          message: 'Test attempt not found for this user.',
        },
        { status: 404 },
      );
    }

    const resolvedSessionId = attempt.sessionId ?? attempt.testId ?? sessionIdFromRoute;

    if (attempt.resultLocked && attempt.finalScores && attempt.moduleResults) {
      return NextResponse.json({
        alreadyFinalized: true,
        result: formatResultPayload({
          sessionId: resolvedSessionId,
          completedAt: attempt.completedAt,
          moduleResults: attempt.moduleResults,
          finalScores: attempt.finalScores,
        }),
      });
    }

    if (attempt.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        {
          error: 'CONFLICT',
          message: `Test attempt cannot be finalized from status ${attempt.status}.`,
        },
        { status: 409 },
      );
    }

    const submissions = buildSubmissionPayload(parsed.data);
    const finalized = finalizeAttemptFromSubmissions(
      attempt.modules as AttemptModuleContent,
      submissions,
    );

    const finalScores: TestSessionFinalScores = {
      listening: finalized.listening.band,
      reading: finalized.reading.band,
      writing: finalized.writing.band,
      speaking: finalized.speaking.band,
      overallBand: finalized.overallBand,
    };

    const completedAt = new Date();

    const updateResult = await TestAttemptModel.updateOne(
      {
        _id: attempt._id,
        studentId: sessionUser.id,
        resultLocked: { $ne: true },
      },
      {
        $set: {
          status: 'COMPLETED',
          sessionId: resolvedSessionId,
          testId: resolvedSessionId,
          completedAt,
          finalizedAt: completedAt,
          submissions,
          moduleResults: finalized,
          finalScores,
          resultLocked: true,
        },
      },
    );

    if (updateResult.modifiedCount === 0) {
      const racedAttempt = await TestAttemptModel.findOne({ _id: attempt._id, studentId: sessionUser.id }).lean<AttemptLookup>();
      if (racedAttempt?.resultLocked && racedAttempt.finalScores && racedAttempt.moduleResults) {
        return NextResponse.json({
          alreadyFinalized: true,
          result: formatResultPayload({
            sessionId: racedAttempt.sessionId ?? racedAttempt.testId ?? resolvedSessionId,
            completedAt: racedAttempt.completedAt,
            moduleResults: racedAttempt.moduleResults,
            finalScores: racedAttempt.finalScores,
          }),
        });
      }

      return NextResponse.json(
        {
          error: 'CONFLICT',
          message: 'Test attempt has already been finalized or locked by another request.',
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      alreadyFinalized: false,
      result: formatResultPayload({
        sessionId: resolvedSessionId,
        completedAt,
        moduleResults: finalized,
        finalScores,
      }),
    });
  } catch (error) {
    return authError(
      'SERVER_ERROR',
      'Failed to finalize the test attempt.',
      500,
      error instanceof Error ? error.message : undefined,
    );
  }
}
