import { NextResponse, type NextRequest } from 'next/server';
import {
  getCertificateTemplatePublicPath,
  renderCertificatePreviewHtml,
} from '@/lib/testing/certificate-preview-renderer';

export const runtime = 'nodejs';

function resolveBaseUrl(request: NextRequest): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredBaseUrl && /^https?:\/\//i.test(configuredBaseUrl)) {
    return configuredBaseUrl.replace(/\/+$/, '');
  }

  return new URL(request.url).origin;
}

export async function GET(request: NextRequest) {
  const baseUrl = resolveBaseUrl(request);
  const sampleCertificateId = 'CERT-SAMPLE-20260419-0001';

  const html = renderCertificatePreviewHtml(
    {
      certificateId: sampleCertificateId,
      fullName: 'Ava Thompson',
      registerNumber: '24UCS046',
      moduleBands: {
        listening: 7.5,
        reading: 7,
        writing: 6.5,
        speaking: 7,
      },
      overallBand: 7,
      issuedAt: '2026-04-19T12:00:00.000Z',
      verificationUrl: `${baseUrl}/api/certificates/verify/${sampleCertificateId}`,
    },
    {
      title: 'Sample IELTS Certificate Preview',
      badgeText: 'Sample Preview',
      templatePublicPath: getCertificateTemplatePublicPath(),
    },
  );

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}