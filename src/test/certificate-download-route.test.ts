/** @jest-environment node */

jest.mock('@/lib/auth/db', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/lib/auth/session', () => ({
  getSessionUserFromRequest: jest.fn(),
}));

jest.mock('@/lib/testing/certificate-model', () => ({
  CertificateModel: {
    findOne: jest.fn(),
  },
}));

jest.mock('@/lib/testing/certificate-pdf-renderer', () => ({
  renderCertificatePdf: jest.fn(),
}));

jest.mock('@/lib/testing/certificate-preview-renderer', () => ({
  getCertificateTemplatePublicPath: jest.fn(),
}));

import { connectToDatabase } from '@/lib/auth/db';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { CertificateModel } from '@/lib/testing/certificate-model';
import { renderCertificatePdf } from '@/lib/testing/certificate-pdf-renderer';
import { getCertificateTemplatePublicPath } from '@/lib/testing/certificate-preview-renderer';

function mockLeanQuery<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe('certificate download route', () => {
  const mockedConnectToDatabase = connectToDatabase as jest.MockedFunction<typeof connectToDatabase>;
  const mockedGetSessionUserFromRequest = getSessionUserFromRequest as jest.MockedFunction<typeof getSessionUserFromRequest>;
  const mockedRenderCertificatePdf = renderCertificatePdf as jest.MockedFunction<typeof renderCertificatePdf>;
  const mockedGetCertificateTemplatePublicPath = getCertificateTemplatePublicPath as jest.MockedFunction<typeof getCertificateTemplatePublicPath>;

  const mockedCertificateModel = CertificateModel as unknown as {
    findOne: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedConnectToDatabase.mockResolvedValue(undefined as never);
    mockedGetSessionUserFromRequest.mockResolvedValue({
      id: 'student-1',
      registerNumber: '24UCS046',
      email: 'student@example.com',
      fullName: 'Student One',
    });
    mockedRenderCertificatePdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
    mockedGetCertificateTemplatePublicPath.mockReturnValue('/certificates/template/certificate-background.png');
  });

  async function callRoute(certificateId: string) {
    const { GET } = await import('../app/api/certificates/download/[certificateId]/route');

    const request = {
      url: `https://example.test/api/certificates/download/${certificateId}`,
    } as unknown as Request;

    return GET(request as never, {
      params: {
        certificateId,
      },
    });
  }

  it('returns 401 when requester is unauthenticated', async () => {
    mockedGetSessionUserFromRequest.mockResolvedValueOnce(null);

    const response = await callRoute('CERT-20260419-OWNED001');
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('UNAUTHORIZED');
  });

  it('returns 404 for missing or non-owned certificate', async () => {
    mockedCertificateModel.findOne.mockReturnValueOnce(mockLeanQuery(null));

    const response = await callRoute('CERT-20260419-MISSING01');
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('NOT_FOUND');
    expect(mockedCertificateModel.findOne).toHaveBeenCalledWith({
      certificateId: 'CERT-20260419-MISSING01',
      studentId: 'student-1',
    });
  });

  it('returns downloadable PDF for an owned certificate', async () => {
    mockedCertificateModel.findOne.mockReturnValueOnce(mockLeanQuery({
      certificateId: 'CERT-20260419-OWNED001',
      fullName: 'Student One',
      registerNumber: '24UCS046',
      moduleBands: {
        listening: 7,
        reading: 7.5,
        writing: 6.5,
        speaking: 7,
      },
      overallBand: 7,
      issuedAt: new Date('2026-04-19T11:15:00.000Z'),
      verificationUrl: 'https://example.test/api/certificates/verify/CERT-20260419-OWNED001',
    }));

    const response = await callRoute('CERT-20260419-OWNED001');
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('attachment; filename="IELTS-Certificate-CERT-20260419-OWNED001.pdf"');
    expect(bytes.length).toBeGreaterThan(0);
    expect(mockedRenderCertificatePdf).toHaveBeenCalledTimes(1);
  });
});