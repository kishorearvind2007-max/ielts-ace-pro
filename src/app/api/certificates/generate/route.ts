import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/auth/db';
import { authError } from '@/lib/auth/http';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { StudentModel } from '@/lib/auth/student-model';
import { normalizeRegisterNumber, type SessionUser } from '@/lib/auth/types';
import {
  buildCertificateEligibilityMessage,
  evaluateCertificateEligibility,
} from '@/lib/testing/certificate-eligibility';
import { toPublicCertificate } from '@/lib/testing/certificate-mappers';
import { CertificateModel, type CertificateDocument } from '@/lib/testing/certificate-model';
import { generateCertificateId } from '@/lib/testing/id';
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';
import type { ModuleBandBreakdown } from '@/lib/testing/types';

export const runtime = 'nodejs';

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 11000;
}

function buildBaseUrl(request: NextRequest): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredBaseUrl && /^https?:\/\//i.test(configuredBaseUrl)) {
    return configuredBaseUrl.replace(/\/+$/, '');
  }

  return new URL(request.url).origin;
}

function buildVerificationUrl(baseUrl: string, certificateId: string): string {
  return `${baseUrl}/api/certificates/verify/${certificateId}`;
}

function buildPreviewUrl(baseUrl: string, certificateId: string): string {
  return `${baseUrl}/api/certificates/preview/${certificateId}`;
}

function buildDownloadUrl(baseUrl: string, certificateId: string): string {
  return `${baseUrl}/api/certificates/download/${certificateId}`;
}

async function resolveSessionStudent(sessionUser: SessionUser) {
  const studentFromSubject = mongoose.isValidObjectId(sessionUser.id)
    ? await StudentModel.findById(sessionUser.id).lean()
    : null;

  if (studentFromSubject) {
    return studentFromSubject;
  }

  const normalizedRegisterNumber = normalizeRegisterNumber(sessionUser.registerNumber);
  if (!normalizedRegisterNumber) {
    return null;
  }

  return StudentModel.findOne({ registerNumber: normalizedRegisterNumber }).lean();
}

function extractModuleBandsFromAttempt(finalScores: unknown): ModuleBandBreakdown {
  const scores = (finalScores ?? {}) as {
    listening?: number;
    reading?: number;
    writing?: number;
    speaking?: number;
  };

  const normalizeBand = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(9, value));
  };

  return {
    listening: normalizeBand(scores.listening),
    reading: normalizeBand(scores.reading),
    writing: normalizeBand(scores.writing),
    speaking: normalizeBand(scores.speaking),
  };
}

export async function POST(request: NextRequest) {
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

    // Find the most recent completed and locked test attempt
    const testAttempt = await TestAttemptModel.findOne({
      studentId: student._id,
      status: 'COMPLETED',
      resultLocked: true,
    })
      .sort({ completedAt: -1, createdAt: -1 })
      .lean();

    if (!testAttempt) {
      return NextResponse.json(
        {
          error: 'NO_COMPLETED_TEST',
          message: 'No completed and finalized test found. Complete all four modules and finalize your test first.',
        },
        { status: 404 },
      );
    }

    if (!testAttempt.finalScores) {
      return authError(
        'VALIDATION_ERROR',
        'Test results are incomplete. Please ensure all modules are evaluated.',
        400,
      );
    }

    // Guard: all four module scores and overall must be non-null (Requirement 4.1, 4.2, 4.3)
    const ms = testAttempt.moduleScores;
    if (
      !ms ||
      ms.listening === null || ms.listening === undefined ||
      ms.reading === null || ms.reading === undefined ||
      ms.writing === null || ms.writing === undefined ||
      ms.speaking === null || ms.speaking === undefined ||
      ms.overall === null || ms.overall === undefined
    ) {
      return NextResponse.json(
        {
          error: 'INCOMPLETE_MODULES',
          message: 'All four modules must be completed before certificate generation.',
        },
        { status: 400 },
      );
    }

    // Extract band scores from the test attempt
    const moduleBands = extractModuleBandsFromAttempt(testAttempt.finalScores);
    const overallBand = typeof testAttempt.finalScores === 'object' && testAttempt.finalScores !== null
      ? (testAttempt.finalScores as { overallBand?: number }).overallBand ?? 0
      : 0;

    const eligibility = evaluateCertificateEligibility({ moduleBands, overallBand });
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

    const baseUrl = buildBaseUrl(request);
    const testId = testAttempt.sessionId;

    // Check if certificate already exists for this test
    const existingCertificate = await CertificateModel.findOne({
      testId,
      studentId: student._id,
    }).lean();

    if (existingCertificate) {
      return NextResponse.json({
        issued: false,
        idempotent: true,
        source: 'database',
        certificate: toPublicCertificate(existingCertificate),
        previewUrl: buildPreviewUrl(baseUrl, existingCertificate.certificateId),
        downloadUrl: buildDownloadUrl(baseUrl, existingCertificate.certificateId),
      });
    }

    let createdCertificate: CertificateDocument | null = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (!createdCertificate && attempts < maxAttempts) {
      attempts += 1;
      const candidateCertificateId = generateCertificateId();

      // Check if this certificateId already exists
      const idExists = await CertificateModel.exists({
        certificateId: candidateCertificateId,
      });

      if (idExists) {
        continue; // Try again with a new certificateId
      }

      try {
        const created = await CertificateModel.create({
          certificateId: candidateCertificateId,
          testId,
          sessionId: testId,
          studentId: student._id,
          attemptId: testAttempt._id,
          resultId: testAttempt._id, // Using attemptId as resultId since we don't have separate result model
          fullName: student.fullName,
          registerNumber: student.registerNumber,
          moduleBands: eligibility.moduleBands,
          overallBand: eligibility.overallBand,
          status: 'ISSUED',
          issuedAt: new Date(),
          verificationUrl: buildVerificationUrl(baseUrl, candidateCertificateId),
        });

        createdCertificate = Array.isArray(created) ? created[0] : created;
      } catch (error) {
        console.error('[certificate/generate] Error during CertificateModel.create:', error);
        if (isDuplicateKeyError(error)) {
          // Check if certificate already exists for this testId or attemptId
          const raced = await CertificateModel.findOne({ testId }).lean();
          if (raced) {
            createdCertificate = raced as CertificateDocument;
            break;
          }
        } else {
          throw error;
        }
      }
    }

    if (!createdCertificate) {
      // Log for debugging
      console.error('[certificate/generate] Failed to allocate unique ID after', maxAttempts, 'attempts');
      throw new Error(`Failed to allocate a unique certificate identity after ${maxAttempts} attempts.`);
    }

    return NextResponse.json({
      issued: true,
      idempotent: false,
      source: 'test-attempt',
      certificate: toPublicCertificate(createdCertificate),
      previewUrl: buildPreviewUrl(baseUrl, createdCertificate.certificateId),
      downloadUrl: buildDownloadUrl(baseUrl, createdCertificate.certificateId),
    });
  } catch (error) {
    return authError(
      'SERVER_ERROR',
      'Failed to generate certificate.',
      500,
      error instanceof Error ? error.message : undefined,
    );
  }
}
