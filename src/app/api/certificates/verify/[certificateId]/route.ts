import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/auth/db';
import { toPublicCertificate } from '@/lib/testing/certificate-mappers';
import { CertificateModel } from '@/lib/testing/certificate-model';

export const runtime = 'nodejs';

type RouteParams = {
  certificateId: string;
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<RouteParams> },
) {
  const { certificateId: rawCertificateId } = await context.params;
  const certificateId = rawCertificateId?.trim();

  if (!certificateId) {
    return NextResponse.json(
      {
        verified: false,
        error: 'INVALID_REQUEST',
        message: 'Missing certificateId route parameter.',
      },
      { status: 400 },
    );
  }

  try {
    await connectToDatabase();

    const certificate = await CertificateModel.findOne({ certificateId }).lean();
    if (!certificate) {
      return NextResponse.json(
        {
          verified: false,
          error: 'NOT_FOUND',
          message: 'Certificate not found.',
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      verified: true,
      certificate: toPublicCertificate(certificate),
    });
  } catch (error) {
    return NextResponse.json(
      {
        verified: false,
        error: 'SERVER_ERROR',
        message: 'Failed to verify certificate.',
        ...(process.env.NODE_ENV !== 'production' && error instanceof Error
          ? { details: error.message }
          : {}),
      },
      { status: 500 },
    );
  }
}
