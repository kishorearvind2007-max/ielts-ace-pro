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
import { generateCertificateId, generateTestId } from '@/lib/testing/id';
import { generateCertificateSchema } from '@/lib/testing/validators';

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

  const parsed = generateCertificateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return authError('VALIDATION_ERROR', 'Invalid certificate generation payload.', 400, parsed.error.flatten());
  }

  const eligibility = evaluateCertificateEligibility({ moduleBands: parsed.data.moduleBands });
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

  try {
    await connectToDatabase();

    const student = await resolveSessionStudent(sessionUser);
    if (!student) {
      return authError('UNAUTHORIZED', 'Session is no longer valid.', 401);
    }

    const baseUrl = buildBaseUrl(request);

    // Check if certificate already exists for this student
    const existingCertificate = await CertificateModel.findOne({
      studentId: student._id,
      'moduleBands.listening': eligibility.moduleBands.listening,
      'moduleBands.reading': eligibility.moduleBands.reading,
      'moduleBands.writing': eligibility.moduleBands.writing,
      'moduleBands.speaking': eligibility.moduleBands.speaking,
      overallBand: eligibility.overallBand,
    }).lean();

    if (existingCertificate) {
      return NextResponse.json({
        issued: false,
        idempotent: true,
        source: 'local-ui',
        certificate: toPublicCertificate(existingCertificate),
        previewUrl: buildPreviewUrl(baseUrl, existingCertificate.certificateId),
        downloadUrl: buildDownloadUrl(baseUrl, existingCertificate.certificateId),
      });
    }

    let createdCertificate: CertificateDocument | null = null;
    let attempts = 0;
    const maxAttempts = 10; // Increased from 5

    while (!createdCertificate && attempts < maxAttempts) {
      attempts += 1;
      const candidateCertificateId = generateCertificateId();
      const candidateTestId = generateTestId();

      // Check if these IDs already exist
      const idExists = await CertificateModel.exists({
        $or: [
          { certificateId: candidateCertificateId },
          { testId: candidateTestId },
        ],
      });

      if (idExists) {
        continue; // Try again with new IDs
      }

      try {
        const created = await CertificateModel.create({
          certificateId: candidateCertificateId,
          testId: candidateTestId,
          studentId: student._id,
          attemptId: new mongoose.Types.ObjectId(),
          resultId: new mongoose.Types.ObjectId(),
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
        if (!isDuplicateKeyError(error)) {
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
      source: 'local-ui',
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
