import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/auth/db';
import { authError } from '@/lib/auth/http';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { finalizeAttemptFromSubmissions } from '@/lib/testing/finalize-service';
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';
import { TestResultModel } from '@/lib/testing/test-result-model';
import type { AttemptModuleContent, AttemptSubmissionPayload } from '@/lib/testing/types';
import { finalizeAttemptSchema, toNumericAnswerMap } from '@/lib/testing/validators';

export const runtime = 'nodejs';

type RouteParams = {
  testId: string;
};

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 11000;
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
  testId: string;
  overallBand: number;
  completedAt: Date;
  modules: unknown;
}) {
  return {
    testId: result.testId,
    overallBand: result.overallBand,
    completedAt: result.completedAt,
    modules: result.modules,
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

  const { testId: rawTestId } = await context.params;
  const testId = rawTestId?.trim();
  if (!testId) {
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

    const existingResult = await TestResultModel.findOne({ testId, studentId: sessionUser.id }).lean();
    if (existingResult) {
      return NextResponse.json({
        alreadyFinalized: true,
        result: formatResultPayload(existingResult),
      });
    }

    const attempt = await TestAttemptModel.findOne({ testId, studentId: sessionUser.id }).lean();
    if (!attempt) {
      return NextResponse.json(
        {
          error: 'NOT_FOUND',
          message: 'Test attempt not found for this user.',
        },
        { status: 404 },
      );
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

    let persistedResult: {
      testId: string;
      overallBand: number;
      completedAt: Date;
      modules: unknown;
    };

    try {
      const createdResult = await TestResultModel.create({
        testId,
        studentId: sessionUser.id,
        attemptId: attempt._id,
        status: 'COMPLETED',
        modules: finalized,
        overallBand: finalized.overallBand,
        completedAt: new Date(),
      });

      persistedResult = {
        testId: createdResult.testId,
        overallBand: createdResult.overallBand,
        completedAt: createdResult.completedAt,
        modules: createdResult.modules,
      };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      const racedResult = await TestResultModel.findOne({ testId, studentId: sessionUser.id }).lean();
      if (!racedResult) {
        throw error;
      }

      persistedResult = {
        testId: racedResult.testId,
        overallBand: racedResult.overallBand,
        completedAt: racedResult.completedAt,
        modules: racedResult.modules,
      };
    }

    await TestAttemptModel.updateOne(
      { _id: attempt._id, studentId: sessionUser.id },
      {
        $set: {
          status: 'COMPLETED',
          finalizedAt: persistedResult.completedAt,
          submissions,
        },
      },
    );

    return NextResponse.json({
      alreadyFinalized: false,
      result: formatResultPayload(persistedResult),
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
