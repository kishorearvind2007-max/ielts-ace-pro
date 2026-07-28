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

jest.mock('@/lib/testing/test-attempt-model', () => ({
  TestAttemptModel: {
    findOne: jest.fn(),
  },
}));

jest.mock('@/lib/testing/certificate-model', () => ({
  CertificateModel: {
    findOne: jest.fn(),
    create: jest.fn(),
    exists: jest.fn(),
  },
}));

jest.mock('@/lib/testing/id', () => ({
  generateCertificateId: jest.fn(),
}));

import { connectToDatabase } from '@/lib/auth/db';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { StudentModel } from '@/lib/auth/student-model';
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';
import { CertificateModel } from '@/lib/testing/certificate-model';
import { generateCertificateId } from '@/lib/testing/id';

function mockLeanQuery<T>(value: T) {
  return {
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe('certificate generate route', () => {
  const mockedConnectToDatabase = connectToDatabase as jest.MockedFunction<typeof connectToDatabase>;
  const mockedGetSessionUserFromRequest = getSessionUserFromRequest as jest.MockedFunction<typeof getSessionUserFromRequest>;
  const mockedGenerateCertificateId = generateCertificateId as jest.MockedFunction<typeof generateCertificateId>;

  const mockedStudentModel = StudentModel as unknown as {
    findById: jest.Mock;
    findOne: jest.Mock;
  };

  const mockedTestAttemptModel = TestAttemptModel as unknown as {
    findOne: jest.Mock;
  };

  const mockedCertificateModel = CertificateModel as unknown as {
    findOne: jest.Mock;
    create: jest.Mock;
    exists: jest.Mock;
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
    mockedCertificateModel.exists.mockResolvedValue(false);
  });

  async function callRoute() {
    const { POST } = await import('../app/api/certificates/generate/route');

    const request = {
      url: 'https://example.test/api/certificates/generate',
    } as unknown as Request;

    return POST(request as never);
  }

  it('returns unauthorized when session is missing', async () => {
    mockedGetSessionUserFromRequest.mockResolvedValueOnce(null);

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('UNAUTHORIZED');
  });

  it('returns 404 when no completed test is found', async () => {
    mockedStudentModel.findById.mockReturnValueOnce(mockLeanQuery({
      _id: '507f1f77bcf86cd799439011',
      fullName: 'Student One',
      registerNumber: '24UCS046',
    }));
    mockedTestAttemptModel.findOne.mockReturnValueOnce(mockLeanQuery(null));

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('NO_COMPLETED_TEST');
  });

  it('returns ineligible when module threshold is not met', async () => {
    mockedStudentModel.findById.mockReturnValueOnce(mockLeanQuery({
      _id: '507f1f77bcf86cd799439011',
      fullName: 'Student One',
      registerNumber: '24UCS046',
    }));
    mockedTestAttemptModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: 'attempt-1',
      sessionId: 'TST-12345',
      studentId: '507f1f77bcf86cd799439011',
      status: 'COMPLETED',
      resultLocked: true,
      finalScores: { listening: 1.5, reading: 6, writing: 6, speaking: 6, overallBand: 5 },
      moduleScores: { listening: 1.5, reading: 6, writing: 6, speaking: 6, overall: 5 },
    }));

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('INELIGIBLE');
    expect(mockedCertificateModel.create).not.toHaveBeenCalled();
  });

  it('creates a certificate from eligible test attempt', async () => {
    mockedStudentModel.findById.mockReturnValueOnce(mockLeanQuery({
      _id: '507f1f77bcf86cd799439011',
      fullName: 'Student One',
      registerNumber: '24UCS046',
    }));
    mockedTestAttemptModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: 'attempt-1',
      sessionId: 'TST-12345',
      studentId: '507f1f77bcf86cd799439011',
      status: 'COMPLETED',
      resultLocked: true,
      finalScores: { listening: 6, reading: 6, writing: 6, speaking: 6, overallBand: 6 },
      moduleScores: { listening: 6, reading: 6, writing: 6, speaking: 6, overall: 6 },
    }));
    mockedCertificateModel.findOne.mockReturnValueOnce(mockLeanQuery(null));

    mockedCertificateModel.create.mockResolvedValue({
      _id: { toString: () => 'cert-doc-local-1' },
      certificateId: 'CERT-20260420-ABCDEF01',
      testId: 'TST-12345',
      sessionId: 'TST-12345',
      fullName: 'Student One',
      registerNumber: '24UCS046',
      moduleBands: { listening: 6, reading: 6, writing: 6, speaking: 6 },
      overallBand: 6,
      status: 'ISSUED',
      issuedAt: new Date('2026-04-20T12:00:00.000Z'),
      verificationUrl: 'https://example.test/api/certificates/verify/CERT-20260420-ABCDEF01',
    });

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.issued).toBe(true);
    expect(json.idempotent).toBe(false);
    expect(json.source).toBe('test-attempt');
    expect(json.certificate.certificateId).toBe('CERT-20260420-ABCDEF01');
    expect(mockedCertificateModel.create).toHaveBeenCalledTimes(1);
  });

  it('returns existing certificate idempotently if already generated', async () => {
    mockedStudentModel.findById.mockReturnValueOnce(mockLeanQuery({
      _id: '507f1f77bcf86cd799439011',
      fullName: 'Student One',
      registerNumber: '24UCS046',
    }));
    mockedTestAttemptModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: 'attempt-1',
      sessionId: 'TST-12345',
      studentId: '507f1f77bcf86cd799439011',
      status: 'COMPLETED',
      resultLocked: true,
      finalScores: { listening: 7, reading: 7, writing: 7, speaking: 7, overallBand: 7 },
      moduleScores: { listening: 7, reading: 7, writing: 7, speaking: 7, overall: 7 },
    }));
    mockedCertificateModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: { toString: () => 'cert-doc-existing-1' },
      certificateId: 'CERT-20260420-EXISTING1',
      testId: 'TST-12345',
      sessionId: 'TST-12345',
      fullName: 'Student One',
      registerNumber: '24UCS046',
      moduleBands: { listening: 7, reading: 7, writing: 7, speaking: 7 },
      overallBand: 7,
      status: 'ISSUED',
      issuedAt: new Date('2026-04-20T13:00:00.000Z'),
      verificationUrl: 'https://example.test/api/certificates/verify/CERT-20260420-EXISTING1',
    }));

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.issued).toBe(false);
    expect(json.idempotent).toBe(true);
    expect(json.certificate.certificateId).toBe('CERT-20260420-EXISTING1');
    expect(mockedCertificateModel.create).not.toHaveBeenCalled();
  });
});
