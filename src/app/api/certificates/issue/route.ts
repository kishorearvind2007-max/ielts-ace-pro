import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/auth/db';
import { authError } from '@/lib/auth/http';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { StudentModel } from '@/lib/auth/student-model';
import {
  buildCertificateEligibilityMessage,
  evaluateCertificateEligibility,
} from '@/lib/testing/certificate-eligibility';
import { toPublicCertificate } from '@/lib/testing/certificate-mappers';
import { CertificateModel, type CertificateDocument } from '@/lib/testing/certificate-model';
import { generateCertificateId } from '@/lib/testing/id';
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';
import type { ModuleBandBreakdown, TestSessionFinalScores } from '@/lib/testing/types';
import { issueCertificateSchema } from '@/lib/testing/validators';

export const runtime = 'nodejs';

type LegacyResultModules = {
  listening?: { band?: number };
  reading?: { band?: number };
  writing?: { band?: number };
  speaking?: { band?: number };
  overallBand?: number;
};

type AttemptLike = {
  _id: unknown;
  sessionId?: string;
  testId?: string;
  status?: string;
  resultLocked?: boolean;
  finalScores?: Partial<TestSessionFinalScores> | null;
  moduleResults?: LegacyResultModules | null;
};

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 11000;
}

function normalizeBand(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(9, value));
}

function extractModuleBands(modules: unknown): ModuleBandBreakdown {
  const source = (modules ?? {}) as LegacyResultModules;

  return {
    listening: normalizeBand(source.listening?.band),
    reading: normalizeBand(source.reading?.band),
    writing: normalizeBand(source.writing?.band),
    speaking: normalizeBand(source.speaking?.band),
  };
}

function resolveFinalScores(attempt: AttemptLike): TestSessionFinalScores {
  const fromFinalScores = attempt.finalScores;
  if (fromFinalScores) {
    return {
      listening: normalizeBand(fromFinalScores.listening),
      reading: normalizeBand(fromFinalScores.reading),
      writing: normalizeBand(fromFinalScores.writing),
      speaking: normalizeBand(fromFinalScores.speaking),
      overallBand: normalizeBand(fromFinalScores.overallBand),
    };
  }

  const moduleBands = extractModuleBands(attempt.moduleResults);
  const legacyOverall = (attempt.moduleResults ?? {}).overallBand;

  return {
    ...moduleBands,
    overallBand: normalizeBand(legacyOverall),
  };
}

function buildSessionLookup(sessionId: string, studentId: string) {
  return {
    studentId,
    $or: [
      { sessionId },
      { testId: sessionId },
    ],
  };
}

function extractRequestedSessionId(input: { sessionId?: string; testId?: string }): string | null {
  const sessionId = input.sessionId?.trim();
  if (sessionId) {
    return sessionId;
  }

  const legacyTestId = input.testId?.trim();
  if (legacyTestId) {
    return legacyTestId;
  }

  return null;
}

function resolveSessionIdFromAttempt(attempt: AttemptLike, fallback: string | null): string {
  return attempt.sessionId ?? attempt.testId ?? fallback ?? '';
}

function toEligibilityInput(scores: TestSessionFinalScores) {
  return {
    moduleBands: {
      listening: scores.listening,
      reading: scores.reading,
      writing: scores.writing,
      speaking: scores.speaking,
    },
    overallBand: scores.overallBand,
  };
}

function buildBaseUrl(request: NextRequest): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredBaseUrl && /^https?:\/\//i.test(configuredBaseUrl)) {
    return configuredBaseUrl.replace(/\/+$/, '');
  }

  return new URL(request.url).origin;
}

function buildVerificationUrl(request: NextRequest, certificateId: string): string {
  return `${buildBaseUrl(request)}/api/certificates/verify/${certificateId}`;
}

function buildPreviewUrl(request: NextRequest, certificateId: string): string {
  return `${buildBaseUrl(request)}/api/certificates/preview/${certificateId}`;
}

function buildDownloadUrl(request: NextRequest, certificateId: string): string {
  return `${buildBaseUrl(request)}/api/certificates/download/${certificateId}`;
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

  const parsed = issueCertificateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return authError('VALIDATION_ERROR', 'Invalid certificate issue payload.', 400, parsed.error.flatten());
  }

  const requestedSessionId = extractRequestedSessionId(parsed.data);

  try {
    await connectToDatabase();

    let attempt: AttemptLike | null;

    if (requestedSessionId) {
      attempt = await TestAttemptModel.findOne(
        buildSessionLookup(requestedSessionId, sessionUser.id),
      ).lean<AttemptLike>();
    } else {
      attempt = await TestAttemptModel.findOne({
        studentId: sessionUser.id,
        status: 'COMPLETED',
        resultLocked: true,
      })
        .sort({ completedAt: -1, createdAt: -1 })
        .lean<AttemptLike>();
    }

    if (!attempt) {
      return NextResponse.json(
        {
          error: 'NOT_FOUND',
          message: 'Completed locked test session not found for certificate issuance.',
        },
        { status: 404 },
      );
    }

    const resolvedSessionId = resolveSessionIdFromAttempt(attempt, requestedSessionId);
    if (!resolvedSessionId) {
      throw new Error('Resolved sessionId is empty for certificate issuance.');
    }

    const existingCertificate = await CertificateModel.findOne({
      sessionId: resolvedSessionId,
      studentId: sessionUser.id,
    }).lean();

    if (existingCertificate) {
      return NextResponse.json({
        issued: false,
        idempotent: true,
        certificate: toPublicCertificate(existingCertificate),
        previewUrl: buildPreviewUrl(request, existingCertificate.certificateId),
        downloadUrl: buildDownloadUrl(request, existingCertificate.certificateId),
      });
    }

    if (attempt.status !== 'COMPLETED' || !attempt.resultLocked) {
      return authError(
        'CONFLICT',
        'Certificate can be issued only from a completed and locked test session.',
        409,
      );
    }

    const finalScores = resolveFinalScores(attempt);
    const eligibility = evaluateCertificateEligibility(toEligibilityInput(finalScores));
    if (!eligibility.qualified) {
      return authError(
        'INELIGIBLE',
        buildCertificateEligibilityMessage(eligibility),
        400,
        {
          threshold: eligibility.threshold,
          failedCriteria: eligibility.failedCriteria,
          moduleBands: eligibility.moduleBands,
          overallBand: eligibility.overallBand,
        },
      );
    }

    const student = await StudentModel.findById(sessionUser.id).lean();
    if (!student) {
      return authError('UNAUTHORIZED', 'Session is no longer valid.', 401);
    }

    let createdCertificate: CertificateDocument | null = null;
    let attempts = 0;

    while (!createdCertificate && attempts < 5) {
      attempts += 1;
      const candidateCertificateId = generateCertificateId();

      try {
        const created = await CertificateModel.create({
          certificateId: candidateCertificateId,
          sessionId: resolvedSessionId,
          // Legacy alias retained during transition.
          testId: resolvedSessionId,
          studentId: sessionUser.id,
          fullName: student.fullName,
          registerNumber: student.registerNumber,
          scores: {
            ...eligibility.moduleBands,
            overallBand: eligibility.overallBand,
          },
          status: 'ISSUED',
          issuedAt: new Date(),
          verificationUrl: buildVerificationUrl(request, candidateCertificateId),
        });

        createdCertificate = Array.isArray(created) ? created[0] : created;
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
      }
    }

    if (!createdCertificate) {
      const racedCertificate = await CertificateModel.findOne({
        sessionId: resolvedSessionId,
        studentId: sessionUser.id,
      }).lean();

      if (racedCertificate) {
        return NextResponse.json({
          issued: false,
          idempotent: true,
          certificate: toPublicCertificate(racedCertificate),
          previewUrl: buildPreviewUrl(request, racedCertificate.certificateId),
          downloadUrl: buildDownloadUrl(request, racedCertificate.certificateId),
        });
      }

      throw new Error('Failed to allocate a unique certificateId after multiple attempts.');
    }

    await TestAttemptModel.updateOne(
      { _id: attempt._id, studentId: sessionUser.id },
      {
        $set: {
          sessionId: resolvedSessionId,
          testId: resolvedSessionId,
          certificateIssued: true,
        },
      },
    );

    return NextResponse.json({
      issued: true,
      idempotent: false,
      certificate: toPublicCertificate(createdCertificate),
      previewUrl: buildPreviewUrl(request, createdCertificate.certificateId),
      downloadUrl: buildDownloadUrl(request, createdCertificate.certificateId),
    });
  } catch (error) {
    return authError(
      'SERVER_ERROR',
      'Failed to issue certificate.',
      500,
      error instanceof Error ? error.message : undefined,
    );
  }
}
