import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { listeningContent, readingContent, speakingContent, writingContent } from '@/data/ielts-content';
import { connectToDatabase } from '@/lib/auth/db';
import { authError } from '@/lib/auth/http';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import type { ListeningSection, ReadingPassage } from '@/lib/ielts-types';
import { generateSessionId } from '@/lib/testing/id';
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';
import type { AttemptModuleContent } from '@/lib/testing/types';
import { createTestAttemptSchema } from '@/lib/testing/validators';

export const runtime = 'nodejs';

function cloneModuleContent(): AttemptModuleContent {
  return {
    listeningSections: structuredClone(listeningContent),
    readingPassages: structuredClone(readingContent),
    writingTasks: structuredClone(writingContent),
    speakingParts: structuredClone(speakingContent),
  };
}

function sanitizeListeningSections(sections: ListeningSection[]) {
  return sections.map(section => ({
    id: section.id,
    title: section.title,
    script: section.script,
    source: section.source,
    metadata: section.metadata,
    questions: section.questions,
  }));
}

function sanitizeReadingPassages(passages: ReadingPassage[]) {
  return passages.map(passage => ({
    id: passage.id,
    title: passage.title,
    text: passage.text,
    questions: passage.questions,
  }));
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 11000;
}

async function createAttemptWithUniqueTestId(
  studentId: string,
  difficulty: string,
  modules: AttemptModuleContent,
) {
  let lastError: unknown = null;

  for (let index = 0; index < 5; index += 1) {
    try {
      const generatedSessionId = generateSessionId();
      return await TestAttemptModel.create({
        sessionId: generatedSessionId,
        // Legacy alias preserved for backward-compatible reads.
        testId: generatedSessionId,
        studentId,
        difficulty,
        status: 'IN_PROGRESS',
        modules,
      });
    } catch (error) {
      lastError = error;
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error('Failed to create a unique test attempt ID.');
}

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUserFromRequest(request);
  if (!sessionUser) {
    return authError('UNAUTHORIZED', 'Not authenticated.', 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    rawBody = {};
  }

  const parsed = createTestAttemptSchema.safeParse(rawBody);
  if (!parsed.success) {
    return authError('VALIDATION_ERROR', 'Invalid test attempt payload.', 400, parsed.error.flatten());
  }

  const difficulty = parsed.data.difficulty ?? 'Band 6';

  try {
    await connectToDatabase();

    const modules = cloneModuleContent();
    const createdAttempt = await createAttemptWithUniqueTestId(sessionUser.id, difficulty, modules);

    const responseSessionId = createdAttempt.sessionId ?? createdAttempt.testId;

    return NextResponse.json({
      sessionId: responseSessionId,
      testId: responseSessionId,
      status: createdAttempt.status,
      difficulty: createdAttempt.difficulty,
      createdAt: createdAttempt.createdAt,
      modules: {
        listeningSections: sanitizeListeningSections(modules.listeningSections),
        readingPassages: sanitizeReadingPassages(modules.readingPassages),
        writingTasks: modules.writingTasks,
        speakingParts: modules.speakingParts,
      },
    });
  } catch (error) {
    return authError(
      'SERVER_ERROR',
      'Failed to create a test attempt.',
      500,
      error instanceof Error ? error.message : undefined,
    );
  }
}
