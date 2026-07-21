/** @jest-environment node */

jest.mock('@/lib/auth/db', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/lib/testing/certificate-model', () => ({
  CertificateModel: {
    findOne: jest.fn(),
  },
}));

import { connectToDatabase } from '@/lib/auth/db';
import { CertificateModel } from '@/lib/testing/certificate-model';

function mockLeanQuery<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe('certificate verify route', () => {
  const mockedConnectToDatabase = connectToDatabase as jest.MockedFunction<typeof connectToDatabase>;
  const mockedCertificateModel = CertificateModel as unknown as {
    findOne: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedConnectToDatabase.mockResolvedValue(undefined as never);
  });

  async function callRoute(certificateId: string) {
    const { GET } = await import('../app/api/certificates/verify/[certificateId]/route');

    const request = {} as Request;
    return GET(request, {
      params: {
        certificateId,
      },
    });
  }

  it('returns verified true for an existing certificate', async () => {
    mockedCertificateModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: { toString: () => 'cert-doc-1' },
      certificateId: 'CERT-20260419-ABCDEF01',
      testId: 'TST-20260419-ABCDEF01',
      fullName: 'Student One',
      registerNumber: '24UCS046',
      moduleBands: {
        listening: 7,
        reading: 7,
        writing: 7,
        speaking: 7,
      },
      overallBand: 7,
      status: 'ISSUED',
      issuedAt: new Date('2026-04-19T11:00:00.000Z'),
      verificationUrl: 'https://example.test/api/certificates/verify/CERT-20260419-ABCDEF01',
    }));

    const response = await callRoute('CERT-20260419-ABCDEF01');
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.verified).toBe(true);
    expect(json.certificate.certificateId).toBe('CERT-20260419-ABCDEF01');
  });

  it('returns 404 for unknown certificate id', async () => {
    mockedCertificateModel.findOne.mockReturnValueOnce(mockLeanQuery(null));

    const response = await callRoute('CERT-20260419-NOTFOUND');
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.verified).toBe(false);
    expect(json.error).toBe('NOT_FOUND');
  });
});
