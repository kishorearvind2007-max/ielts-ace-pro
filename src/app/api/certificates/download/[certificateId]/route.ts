import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/auth/db';
import { authError } from '@/lib/auth/http';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { CertificateModel } from '@/lib/testing/certificate-model';
import {
  getCertificateTemplatePublicPath,
} from '@/lib/testing/certificate-preview-renderer';
import { renderCertificatePdf } from '@/lib/testing/certificate-pdf-renderer';

export const runtime = 'nodejs';

type RouteParams = {
  certificateId: string;
};

function normalizeBand(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(9, value));
}

function resolveVerificationUrl(request: NextRequest, certificateId: string, value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const baseUrl = configuredBaseUrl && /^https?:\/\//i.test(configuredBaseUrl)
    ? configuredBaseUrl.replace(/\/+$/, '')
    : new URL(request.url).origin;

  return `${baseUrl}/api/certificates/verify/${certificateId}`;
}

function buildDownloadFileName(certificateId: string): string {
  const safeId = certificateId.replace(/[^A-Za-z0-9_.-]/g, '_');
  return `IELTS-Certificate-${safeId}.pdf`;
}

function extractCertificateScores(certificate: {
  scores?: {
    listening?: number;
    reading?: number;
    writing?: number;
    speaking?: number;
    overallBand?: number;
  };
  moduleBands?: {
    listening?: number;
    reading?: number;
    writing?: number;
    speaking?: number;
  };
  overallBand?: number;
}) {
  const scores = certificate.scores ?? {};
  const legacyBands = certificate.moduleBands ?? {};

  return {
    listening: normalizeBand(scores.listening ?? legacyBands.listening),
    reading: normalizeBand(scores.reading ?? legacyBands.reading),
    writing: normalizeBand(scores.writing ?? legacyBands.writing),
    speaking: normalizeBand(scores.speaking ?? legacyBands.speaking),
    overallBand: normalizeBand(scores.overallBand ?? certificate.overallBand),
  };
}

export async function GET(request: NextRequest, context: { params: Promise<RouteParams> }) {
  const sessionUser = await getSessionUserFromRequest(request);
  if (!sessionUser) {
    return authError('UNAUTHORIZED', 'Not authenticated.', 401);
  }

  const { certificateId: rawCertificateId } = await context.params;
  const certificateId = rawCertificateId?.trim();
  if (!certificateId) {
    return authError('INVALID_REQUEST', 'Missing certificateId route parameter.', 400);
  }

  try {
    await connectToDatabase();

    const certificate = await CertificateModel.findOne({
      certificateId,
      studentId: sessionUser.id,
    }).lean();

    if (!certificate) {
      return NextResponse.json(
        {
          error: 'NOT_FOUND',
          message: 'Certificate not found.',
        },
        { status: 404 },
      );
    }

    const resolvedScores = extractCertificateScores(certificate);

    const pdfBytes = await renderCertificatePdf(
      {
        certificateId,
        fullName: certificate.fullName,
        registerNumber: certificate.registerNumber,
        moduleBands: {
          listening: resolvedScores.listening,
          reading: resolvedScores.reading,
          writing: resolvedScores.writing,
          speaking: resolvedScores.speaking,
        },
        overallBand: resolvedScores.overallBand,
        issuedAt: certificate.issuedAt,
        verificationUrl: resolveVerificationUrl(request, certificateId, certificate.verificationUrl),
      },
      {
        templatePublicPath: getCertificateTemplatePublicPath(),
      },
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${buildDownloadFileName(certificateId)}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return authError(
      'SERVER_ERROR',
      'Failed to generate certificate download.',
      500,
      error instanceof Error ? error.message : undefined,
    );
  }
}