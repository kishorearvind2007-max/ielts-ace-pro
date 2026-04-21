/** @jest-environment node */

jest.mock('@/lib/auth/db', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/lib/auth/session', () => ({
  getSessionUserFromRequest: jest.fn(),
}));

jest.mock('@/lib/auth/student-model', () => ({
  StudentModel: {
    findById: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.mock('@/lib/testing/certificate-model', () => ({
  CertificateModel: {
    create: jest.fn(),
  },
}));

jest.mock('@/lib/testing/id', () => ({
  generateCertificateId: jest.fn(),
  generateTestId: jest.fn(),
}));

import { connectToDatabase } from '@/lib/auth/db';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { StudentModel } from '@/lib/auth/student-model';
import { CertificateModel } from '@/lib/testing/certificate-model';
import { generateCertificateId, generateTestId } from '@/lib/testing/id';

function mockLeanQuery<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe('certificate generate route', () => {
  const mockedConnectToDatabase = connectToDatabase as jest.MockedFunction<typeof connectToDatabase>;
  const mockedGetSessionUserFromRequest = getSessionUserFromRequest as jest.MockedFunction<typeof getSessionUserFromRequest>;
  const mockedGenerateCertificateId = generateCertificateId as jest.MockedFunction<typeof generateCertificateId>;
  const mockedGenerateTestId = generateTestId as jest.MockedFunction<typeof generateTestId>;

  const mockedStudentModel = StudentModel as unknown as {
    findById: jest.Mock;
    findOne: jest.Mock;
  };

  const mockedCertificateModel = CertificateModel as unknown as {
    create: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedConnectToDatabase.mockResolvedValue(undefined as never);
    mockedGetSessionUserFromRequest.mockResolvedValue({
      id: '507f1f77bcf86cd799439011',
      registerNumber: '24UCS046',
      email: 'student@example.com',
      fullName: 'Student One',
    });
    mockedGenerateCertificateId.mockReturnValue('CERT-20260420-ABCDEF01');
    mockedGenerateTestId.mockReturnValue('TST-20260420-ABCDEF01');
  });

  async function callRoute(body: unknown) {
    const { POST } = await import('../app/api/certificates/generate/route');

    const request = {
      url: 'https://example.test/api/certificates/generate',
      json: async () => body,
    } as unknown as Request;

    return POST(request as never);
  }

  it('returns unauthorized when session is missing', async () => {
    mockedGetSessionUserFromRequest.mockResolvedValueOnce(null);

    const response = await callRoute({
      moduleBands: {
        listening: 6,
        reading: 6,
        writing: 6,
        speaking: 6,
      },
    });
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('UNAUTHORIZED');
  });

  it('returns validation error for malformed payload', async () => {
    const response = await callRoute({
      moduleBands: {
        listening: 6,
      },
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('VALIDATION_ERROR');
    expect(mockedConnectToDatabase).not.toHaveBeenCalled();
  });

  it('returns ineligible when module threshold is not met', async () => {
    const response = await callRoute({
      moduleBands: {
        listening: 1.5,
        reading: 6,
        writing: 6,
        speaking: 6,
      },
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('INELIGIBLE');
    expect(mockedConnectToDatabase).not.toHaveBeenCalled();
    expect(mockedCertificateModel.create).not.toHaveBeenCalled();
  });

  it('creates a certificate from eligible local module bands', async () => {
    mockedStudentModel.findById.mockReturnValueOnce(mockLeanQuery({
      _id: '507f1f77bcf86cd799439011',
      fullName: 'Student One',
      registerNumber: '24UCS046',
    }));

    mockedCertificateModel.create.mockResolvedValue({
      _id: { toString: () => 'cert-doc-local-1' },
      certificateId: 'CERT-20260420-ABCDEF01',
      testId: 'TST-20260420-ABCDEF01',
      fullName: 'Student One',
      registerNumber: '24UCS046',
      moduleBands: {
        listening: 6,
        reading: 6,
        writing: 6,
        speaking: 6,
      },
      overallBand: 6,
      status: 'ISSUED',
      issuedAt: new Date('2026-04-20T12:00:00.000Z'),
      verificationUrl: 'https://example.test/api/certificates/verify/CERT-20260420-ABCDEF01',
    });

    const response = await callRoute({
      moduleBands: {
        listening: 6,
        reading: 6,
        writing: 6,
        speaking: 6,
      },
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.issued).toBe(true);
    expect(json.idempotent).toBe(false);
    expect(json.source).toBe('local-ui');
    expect(json.certificate.certificateId).toBe('CERT-20260420-ABCDEF01');
    expect(json.previewUrl).toBe('https://example.test/api/certificates/preview/CERT-20260420-ABCDEF01');
    expect(json.downloadUrl).toBe('https://example.test/api/certificates/download/CERT-20260420-ABCDEF01');
    expect(mockedCertificateModel.create).toHaveBeenCalledTimes(1);
  });

  it('falls back to register-number lookup for legacy non-objectid session subjects', async () => {
    mockedGetSessionUserFromRequest.mockResolvedValueOnce({
      id: 'legacy-subject',
      registerNumber: '24UCS046',
      email: 'student@example.com',
      fullName: 'Student One',
    });

    mockedStudentModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: '507f1f77bcf86cd799439022',
      fullName: 'Student One',
      registerNumber: '24UCS046',
    }));

    mockedCertificateModel.create.mockResolvedValue({
      _id: { toString: () => 'cert-doc-local-2' },
      certificateId: 'CERT-20260420-ABCDEF01',
      testId: 'TST-20260420-ABCDEF01',
      fullName: 'Student One',
      registerNumber: '24UCS046',
      moduleBands: {
        listening: 6,
        reading: 6,
        writing: 6,
        speaking: 6,
      },
      overallBand: 6,
      status: 'ISSUED',
      issuedAt: new Date('2026-04-20T12:30:00.000Z'),
      verificationUrl: 'https://example.test/api/certificates/verify/CERT-20260420-ABCDEF01',
    });

    const response = await callRoute({
      moduleBands: {
        listening: 6,
        reading: 6,
        writing: 6,
        speaking: 6,
      },
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.issued).toBe(true);
    expect(json.downloadUrl).toBe('https://example.test/api/certificates/download/CERT-20260420-ABCDEF01');
    expect(mockedStudentModel.findById).not.toHaveBeenCalled();
    expect(mockedStudentModel.findOne).toHaveBeenCalledWith({ registerNumber: '24UCS046' });
    expect(mockedCertificateModel.create).toHaveBeenCalledTimes(1);
  });
});
