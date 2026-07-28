/** @jest-environment node */

jest.mock('@/lib/auth/db', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/lib/auth/session', () => ({
  getSessionUserFromRequest: jest.fn(),
}));

jest.mock('@/lib/testing/test-attempt-model', () => ({
  TestAttemptModel: {
    findOne: jest.fn(() => ({
      sort: jest.fn(() => ({
        lean: jest.fn(),
      })),
    })),
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
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';
import * as fc from 'fast-check';

describe('POST /api/certificates/generate - INCOMPLETE_MODULES guard', () => {
  const mockedConnectToDatabase = connectToDatabase as jest.MockedFunction<typeof connectToDatabase>;
  const mockedGetSessionUserFromRequest = getSessionUserFromRequest as jest.MockedFunction<
    typeof getSessionUserFromRequest
  >;

  const mockedAttemptModel = TestAttemptModel as unknown as {
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
  });

  async function callRoute() {
    const { POST } = await import('../app/api/certificates/generate/route');

    const request = {
      json: async () => ({}),
    } as unknown as Request;

    return POST(request as never);
  }

  describe('Incomplete Modules Guard', () => {
    it('returns 400 INCOMPLETE_MODULES when moduleScores is null', async () => {
      const sortMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'attempt-1',
          sessionId: 'TST-123',
          studentId: 'student-1',
          status: 'COMPLETED',
          resultLocked: true,
          moduleScores: null, // No module scores
          finalScores: null,
          completedAt: new Date(),
        }),
      });

      mockedAttemptModel.findOne.mockReturnValue({
        sort: sortMock,
      } as never);

      const response = await callRoute();
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('INCOMPLETE_MODULES');
      expect(json.message).toContain('complete all four modules');
    });

    it('returns 400 INCOMPLETE_MODULES when listening score is null', async () => {
      const sortMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'attempt-1',
          sessionId: 'TST-123',
          studentId: 'student-1',
          status: 'COMPLETED',
          resultLocked: true,
          moduleScores: {
            listening: null, // Missing
            reading: 7.0,
            writing: 6.5,
            speaking: 7.0,
            overall: 7.0,
          },
          finalScores: null,
          completedAt: new Date(),
        }),
      });

      mockedAttemptModel.findOne.mockReturnValue({
        sort: sortMock,
      } as never);

      const response = await callRoute();
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('INCOMPLETE_MODULES');
    });

    it('returns 400 INCOMPLETE_MODULES when overall score is null', async () => {
      const sortMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'attempt-1',
          sessionId: 'TST-123',
          studentId: 'student-1',
          status: 'COMPLETED',
          resultLocked: true,
          moduleScores: {
            listening: 7.0,
            reading: 7.0,
            writing: 6.5,
            speaking: 7.0,
            overall: null, // Missing overall
          },
          finalScores: null,
          completedAt: new Date(),
        }),
      });

      mockedAttemptModel.findOne.mockReturnValue({
        sort: sortMock,
      } as never);

      const response = await callRoute();
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('INCOMPLETE_MODULES');
    });

    /**
     * Property 7: Certificate generation rejection
     * Validates: Requirements 4.1, 4.2, 4.3
     * For any moduleScores with at least one null value,
     * the endpoint must return 400 with error code INCOMPLETE_MODULES
     */
    it('property: rejects certificate generation when any module score is null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            listening: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            reading: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            writing: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            speaking: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            overall: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
          }),
          async (moduleScores) => {
            // Check if any score is null
            const hasNullScore =
              moduleScores.listening === null ||
              moduleScores.reading === null ||
              moduleScores.writing === null ||
              moduleScores.speaking === null ||
              moduleScores.overall === null;

            if (!hasNullScore) {
              // Skip this test case if all scores are present
              return;
            }

            const sortMock = jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue({
                _id: 'attempt-prop',
                sessionId: 'TST-PROP',
                studentId: 'student-1',
                status: 'COMPLETED',
                resultLocked: true,
                moduleScores,
                finalScores: null,
                completedAt: new Date(),
              }),
            });

            mockedAttemptModel.findOne.mockReturnValue({
              sort: sortMock,
            } as never);

            const response = await callRoute();
            const json = await response.json();

            // Should return 400 with INCOMPLETE_MODULES error
            expect(response.status).toBe(400);
            expect(json.error).toBe('INCOMPLETE_MODULES');
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
