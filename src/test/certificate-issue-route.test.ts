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

jest.mock('@/lib/testing/test-attempt-model', () => ({
  TestAttemptModel: {
    findOne: jest.fn(),
    updateOne: jest.fn(),
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
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';

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

  const mockedAttemptModel = TestAttemptModel as unknown as {
    findOne: jest.Mock;
    updateOne: jest.Mock;
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
    mockedAttemptModel.updateOne.mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });
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
    mockedAttemptModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: 'attempt-doc-1',
      sessionId: 'TST-20260419-ABCDEF01',
      status: 'COMPLETED',
      resultLocked: true,
      finalScores: {
        listening: 7,
        reading: 7,
        writing: 7,
        speaking: 7,
        overallBand: 7,
      },
    }));

    mockedCertificateModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: { toString: () => 'cert-doc-1' },
      certificateId: 'CERT-20260419-ABCDEF01',
      sessionId: 'TST-20260419-ABCDEF01',
      fullName: 'Student One',
      registerNumber: '24UCS046',
      scores: {
        listening: 7,
        reading: 7,
        writing: 7,
        speaking: 7,
        overallBand: 7,
      },
      status: 'ISSUED',
      issuedAt: new Date('2026-04-19T11:00:00.000Z'),
      verificationUrl: 'https://example.test/api/certificates/verify/CERT-20260419-ABCDEF01',
    }));

    const response = await callRoute({ sessionId: 'TST-20260419-ABCDEF01' });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.issued).toBe(false);
    expect(json.idempotent).toBe(true);
    expect(json.certificate.certificateId).toBe('CERT-20260419-ABCDEF01');
    expect(json.previewUrl).toBe('https://example.test/api/certificates/preview/CERT-20260419-ABCDEF01');
    expect(json.downloadUrl).toBe('https://example.test/api/certificates/download/CERT-20260419-ABCDEF01');
  });

  it('rejects issuance when completed result is below eligibility threshold', async () => {
    mockedAttemptModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: 'attempt-doc-ineligible',
      sessionId: 'TST-20260419-TOOLOW01',
      status: 'COMPLETED',
      resultLocked: true,
      finalScores: {
        listening: 1.5,
        reading: 2.5,
        writing: 2.5,
        speaking: 2.5,
        overallBand: 2,
      },
    }));

    mockedCertificateModel.findOne.mockReturnValueOnce(mockLeanQuery(null));

    const response = await callRoute({ sessionId: 'TST-20260419-TOOLOW01' });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('INELIGIBLE');
    expect(mockedCertificateModel.create).not.toHaveBeenCalled();
    expect(mockedStudentModel.findById).not.toHaveBeenCalled();
  });

  it('issues a new certificate from completed backend result', async () => {
    mockedAttemptModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: 'attempt-doc-1',
      sessionId: 'TST-20260419-ABCDEF01',
      status: 'COMPLETED',
      resultLocked: true,
      finalScores: {
        listening: 6.5,
        reading: 6.5,
        writing: 6.5,
        speaking: 6.5,
        overallBand: 6.5,
      },
    }));

    mockedCertificateModel.findOne.mockReturnValueOnce(mockLeanQuery(null));

    mockedStudentModel.findById.mockReturnValueOnce(mockLeanQuery({
      fullName: 'Student One',
      registerNumber: '24UCS046',
    }));

    mockedCertificateModel.create.mockResolvedValue({
      _id: { toString: () => 'cert-doc-2' },
      certificateId: 'CERT-20260419-NEWCERT01',
      sessionId: 'TST-20260419-ABCDEF01',
      fullName: 'Student One',
      registerNumber: '24UCS046',
      scores: {
        listening: 6.5,
        reading: 6.5,
        writing: 6.5,
        speaking: 6.5,
        overallBand: 6.5,
      },
      status: 'ISSUED',
      issuedAt: new Date('2026-04-19T11:05:00.000Z'),
      verificationUrl: 'https://example.test/api/certificates/verify/CERT-20260419-NEWCERT01',
    });

    const response = await callRoute({ sessionId: 'TST-20260419-ABCDEF01' });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.issued).toBe(true);
    expect(json.idempotent).toBe(false);
    expect(json.certificate.certificateId).toBe('CERT-20260419-NEWCERT01');
    expect(json.previewUrl).toBe('https://example.test/api/certificates/preview/CERT-20260419-NEWCERT01');
    expect(json.downloadUrl).toBe('https://example.test/api/certificates/download/CERT-20260419-NEWCERT01');
    expect(mockedCertificateModel.create).toHaveBeenCalledTimes(1);
    expect(mockedAttemptModel.updateOne).toHaveBeenCalledTimes(1);
  });
});
