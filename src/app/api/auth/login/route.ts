import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/auth/db';
import { DEMO_USER, DEMO_USER_MODULE_BANDS, isDemoCredentialInput } from '@/lib/auth/demo-user';
import { authError } from '@/lib/auth/http';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { attachSessionCookie } from '@/lib/auth/session';
import { toPublicStudent, toSessionUser } from '@/lib/auth/student-mappers';
import { StudentModel } from '@/lib/auth/student-model';
import { normalizeEmail, normalizeRegisterNumber } from '@/lib/auth/types';
import { loginSchema } from '@/lib/auth/validators';
import { generateSessionId } from '@/lib/testing/id';
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';
import type { FinalizedAttemptResult } from '@/lib/testing/types';

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

async function ensureDemoTestAttempt(studentId: string) {
  // Check if a completed test already exists
  const existingTest = await TestAttemptModel.findOne({
    studentId,
    status: 'COMPLETED',
    resultLocked: true,
  });

  if (existingTest) {
    return existingTest;
  }

  // Create a finalized test attempt with 7.0 band scores
  const finalScores: FinalizedAttemptResult = {
    listening: {
      band: DEMO_USER_MODULE_BANDS.listening,
      rawScore: 35,
      totalQuestions: 40,
      listeningValidation: {
        totalQuestions: 40,
        rawScore: 35,
        percentage: 87.5,
        sections: [],
      },
    },
    reading: {
      band: DEMO_USER_MODULE_BANDS.reading,
      rawScore: 35,
      totalQuestions: 40,
      percentage: 87.5,
      detailedResults: {
        rawScore: 35,
        band: DEMO_USER_MODULE_BANDS.reading,
        totalQuestions: 40,
        percentage: 87.5,
        questionTypeBreakdown: {},
        passageResults: [],
        timing: {
          totalTime: 3600,
          avgTimePerQuestion: 90,
          timeRemaining: 0,
        },
      },
    },
    writing: {
      band: DEMO_USER_MODULE_BANDS.writing,
      criteriaScores: {
        taskAchievement: { band: 7, feedback: 'Strong task completion with clear arguments.' },
        coherenceCohesion: { band: 7, feedback: 'Well-organized with effective linking.' },
        lexicalResource: { band: 7, feedback: 'Good vocabulary range and accuracy.' },
        grammaticalRange: { band: 7, feedback: 'Wide range of structures with good control.' },
      },
      strengths: ['Clear arguments', 'Good organization', 'Strong vocabulary'],
      improvements: ['Could add more complex sentences', 'Expand examples further'],
      examinerComment: 'Demo test with Band 7.0 performance across all criteria.',
      taskWordCounts: {
        task1: 165,
        task2: 280,
      },
    },
    speaking: {
      band: DEMO_USER_MODULE_BANDS.speaking,
      criteriaScores: {
        fluencyCohesion: { band: 7, feedback: 'Speaks fluently with minimal hesitation.' },
        lexicalResource: { band: 7, feedback: 'Good vocabulary with some flexibility.' },
        grammaticalRange: { band: 7, feedback: 'Uses a range of structures accurately.' },
        pronunciation: { band: 7, feedback: 'Clear pronunciation with good intonation.' },
      },
      strengths: ['Natural fluency', 'Clear pronunciation', 'Good vocabulary range'],
      improvements: ['Could use more idiomatic expressions', 'Vary sentence structures more'],
      examinerComment: 'Demo test with Band 7.0 performance across all criteria.',
      transcriptWordCount: 850,
    },
    overallBand: 7.0,
  };

  return TestAttemptModel.create({
    sessionId: generateSessionId(),
    studentId,
    difficulty: 'Band 7',
    status: 'COMPLETED',
    modules: {
      listeningSections: [],
      readingPassages: [],
      writingTasks: [],
      speakingParts: [],
    },
    submissions: {
      listeningAnswers: {},
      readingAnswers: {},
      writingResponses: { task1: 'Demo response', task2: 'Demo response' },
      speakingTranscripts: { part1: 'Demo transcript', part2: 'Demo transcript', part3: 'Demo transcript' },
    },
    finalScores,
    resultLocked: true,
    certificateIssued: false,
    completedAt: new Date(),
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
      await ensureDemoTestAttempt(demoStudent._id.toString());

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