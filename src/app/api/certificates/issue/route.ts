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
import { TestResultModel } from '@/lib/testing/test-result-model';
import type { ModuleBandBreakdown } from '@/lib/testing/types';
import { issueCertificateSchema } from '@/lib/testing/validators';

export const runtime = 'nodejs';

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 11000;
}

function extractModuleBands(modules: unknown): ModuleBandBreakdown {
  const source = (modules ?? {}) as {
    listening?: { band?: number };
    reading?: { band?: number };
    writing?: { band?: number };
    speaking?: { band?: number };
  };

  const normalizeBand = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, Math.min(9, value));
  };

  return {
    listening: normalizeBand(source.listening?.band),
    reading: normalizeBand(source.reading?.band),
    writing: normalizeBand(source.writing?.band),
    speaking: normalizeBand(source.speaking?.band),
  };
}

function buildVerificationUrl(request: NextRequest, certificateId: string): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const baseUrl = configuredBaseUrl && /^https?:\/\//i.test(configuredBaseUrl)
    ? configuredBaseUrl.replace(/\/+$/, '')
    : new URL(request.url).origin;

  return `${baseUrl}/api/certificates/verify/${certificateId}`;
}

function buildPreviewUrl(request: NextRequest, certificateId: string): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const baseUrl = configuredBaseUrl && /^https?:\/\//i.test(configuredBaseUrl)
    ? configuredBaseUrl.replace(/\/+$/, '')
    : new URL(request.url).origin;

  return `${baseUrl}/api/certificates/preview/${certificateId}`;
}

function buildDownloadUrl(request: NextRequest, certificateId: string): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const baseUrl = configuredBaseUrl && /^https?:\/\//i.test(configuredBaseUrl)
    ? configuredBaseUrl.replace(/\/+$/, '')
    : new URL(request.url).origin;

  return `${baseUrl}/api/certificates/download/${certificateId}`;
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
    return authError('INVALID_REQUEST', 'Invalid JSON payload.', 400);
  }

  const parsed = issueCertificateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return authError('VALIDATION_ERROR', 'Invalid certificate issue payload.', 400, parsed.error.flatten());
  }

  const testId = parsed.data.testId;

  try {
    await connectToDatabase();

    const existingCertificate = await CertificateModel.findOne({ testId, studentId: sessionUser.id }).lean();
    if (existingCertificate) {
      return NextResponse.json({
        issued: false,
        idempotent: true,
        certificate: toPublicCertificate(existingCertificate),
        previewUrl: buildPreviewUrl(request, existingCertificate.certificateId),
        downloadUrl: buildDownloadUrl(request, existingCertificate.certificateId),
      });
    }

    const result = await TestResultModel.findOne({ testId, studentId: sessionUser.id }).lean();
    if (!result) {
      return NextResponse.json(
        {
          error: 'NOT_FOUND',
          message: 'Completed test result not found for this testId.',
        },
        { status: 404 },
      );
    }

    const moduleBands = extractModuleBands(result.modules);
    const eligibility = evaluateCertificateEligibility({
      moduleBands,
      overallBand: result.overallBand,
    });
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
          testId,
          sessionId: testId,
          studentId: sessionUser.id,
          attemptId: result.attemptId,
          resultId: result._id,
          fullName: student.fullName,
          registerNumber: student.registerNumber,
          moduleBands: eligibility.moduleBands,
          overallBand: eligibility.overallBand,
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
      const racedCertificate = await CertificateModel.findOne({ testId, studentId: sessionUser.id }).lean();
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
