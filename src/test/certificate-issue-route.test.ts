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
  },
}));

jest.mock('@/lib/testing/test-result-model', () => ({
  TestResultModel: {
    findOne: jest.fn(),
  },
}));

jest.mock('@/lib/testing/certificate-model', () => ({
  CertificateModel: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

import { connectToDatabase } from '@/lib/auth/db';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { StudentModel } from '@/lib/auth/student-model';
import { CertificateModel } from '@/lib/testing/certificate-model';
import { TestResultModel } from '@/lib/testing/test-result-model';

function mockLeanQuery<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe('certificate issue route', () => {
  const mockedConnectToDatabase = connectToDatabase as jest.MockedFunction<typeof connectToDatabase>;
  const mockedGetSessionUserFromRequest = getSessionUserFromRequest as jest.MockedFunction<typeof getSessionUserFromRequest>;

  const mockedStudentModel = StudentModel as unknown as {
    findById: jest.Mock;
  };

  const mockedResultModel = TestResultModel as unknown as {
    findOne: jest.Mock;
  };

  const mockedCertificateModel = CertificateModel as unknown as {
    findOne: jest.Mock;
    create: jest.Mock;
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
  });

  async function callRoute(body: unknown) {
    const { POST } = await import('../app/api/certificates/issue/route');

    const request = {
      url: 'https://example.test/api/certificates/issue',
      json: async () => body,
    } as unknown as Request;

    return POST(request as never);
  }

  it('returns existing certificate idempotently when already issued', async () => {
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

    const response = await callRoute({ testId: 'TST-20260419-ABCDEF01' });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.issued).toBe(false);
    expect(json.idempotent).toBe(true);
    expect(json.certificate.certificateId).toBe('CERT-20260419-ABCDEF01');
    expect(json.previewUrl).toBe('https://example.test/api/certificates/preview/CERT-20260419-ABCDEF01');
    expect(json.downloadUrl).toBe('https://example.test/api/certificates/download/CERT-20260419-ABCDEF01');
  });

  it('rejects issuance when completed result is below eligibility threshold', async () => {
    mockedCertificateModel.findOne.mockReturnValueOnce(mockLeanQuery(null));

    mockedResultModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: 'result-doc-ineligible',
      attemptId: 'attempt-doc-ineligible',
      overallBand: 2,
      modules: {
        listening: { band: 1.5 },
        reading: { band: 2.5 },
        writing: { band: 2.5 },
        speaking: { band: 2.5 },
      },
    }));

    const response = await callRoute({ testId: 'TST-20260419-TOOLOW01' });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('INELIGIBLE');
    expect(mockedCertificateModel.create).not.toHaveBeenCalled();
    expect(mockedStudentModel.findById).not.toHaveBeenCalled();
  });

  it('issues a new certificate from completed backend result', async () => {
    mockedCertificateModel.findOne.mockReturnValueOnce(mockLeanQuery(null));

    mockedResultModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: 'result-doc-1',
      attemptId: 'attempt-doc-1',
      overallBand: 6.5,
      modules: {
        listening: { band: 6.5 },
        reading: { band: 6.5 },
        writing: { band: 6.5 },
        speaking: { band: 6.5 },
      },
    }));

    mockedStudentModel.findById.mockReturnValueOnce(mockLeanQuery({
      fullName: 'Student One',
      registerNumber: '24UCS046',
    }));

    mockedCertificateModel.create.mockResolvedValue({
      _id: { toString: () => 'cert-doc-2' },
      certificateId: 'CERT-20260419-NEWCERT01',
      testId: 'TST-20260419-ABCDEF01',
      fullName: 'Student One',
      registerNumber: '24UCS046',
      moduleBands: {
        listening: 6.5,
        reading: 6.5,
        writing: 6.5,
        speaking: 6.5,
      },
      overallBand: 6.5,
      status: 'ISSUED',
      issuedAt: new Date('2026-04-19T11:05:00.000Z'),
      verificationUrl: 'https://example.test/api/certificates/verify/CERT-20260419-NEWCERT01',
    });

    const response = await callRoute({ testId: 'TST-20260419-ABCDEF01' });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.issued).toBe(true);
    expect(json.idempotent).toBe(false);
    expect(json.certificate.certificateId).toBe('CERT-20260419-NEWCERT01');
    expect(json.previewUrl).toBe('https://example.test/api/certificates/preview/CERT-20260419-NEWCERT01');
    expect(json.downloadUrl).toBe('https://example.test/api/certificates/download/CERT-20260419-NEWCERT01');
    expect(mockedCertificateModel.create).toHaveBeenCalledTimes(1);
  });
});
