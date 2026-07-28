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

import { connectToDatabase } from '@/lib/auth/db';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';
import * as fc from 'fast-check';

describe('GET /api/test-attempts/active', () => {
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
    const { GET } = await import('../app/api/test-attempts/active/route');

    const request = {} as unknown as Request;

    return GET(request as never);
  }

  describe('Empty State Response', () => {
    it('returns null sessionId and moduleScores when no active attempt exists', async () => {
      const sortMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      mockedAttemptModel.findOne.mockReturnValue({
        sort: sortMock,
      } as never);

      const response = await callRoute();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.sessionId).toBeNull();
      expect(json.moduleScores).toBeNull();
    });
  });

  describe('Active Attempt Response', () => {
    it('returns sessionId, status, moduleScores, and moduleResults when active attempt exists', async () => {
      const sortMock = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'attempt-1',
          sessionId: 'TST-20260727-ABC123',
          studentId: 'student-1',
          status: 'IN_PROGRESS',
          moduleScores: {
            listening: 7.0,
            reading: 6.5,
            writing: null,
            speaking: null,
            overall: null,
          },
          moduleResults: {
            listening: { band: 7.0, rawScore: 35, totalQuestions: 40 },
            reading: { band: 6.5, rawScore: 30, totalQuestions: 40 },
          },
          createdAt: new Date('2026-07-27T10:00:00.000Z'),
        }),
      });

      mockedAttemptModel.findOne.mockReturnValue({
        sort: sortMock,
      } as never);

      const response = await callRoute();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.sessionId).toBe('TST-20260727-ABC123');
      expect(json.status).toBe('IN_PROGRESS');
      expect(json.moduleScores).toEqual({
        listening: 7.0,
        reading: 6.5,
        writing: null,
        speaking: null,
        overall: null,
      });
      expect(json.moduleResults).toBeDefined();
    });

    /**
     * Property 9: Active attempt response round-trip
     * Validates: Requirements 7.3
     * For any Active_Attempt with any combination of module scores,
     * the API response must contain the exact same sessionId, status, and moduleScores as stored in the database
     */
    it('property: response contains exact same data as database', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sessionId: fc.string({ minLength: 10, maxLength: 30 }),
            status: fc.constantFrom('IN_PROGRESS', 'COMPLETED'),
            listening: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            reading: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            writing: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
            speaking: fc.option(fc.double({ min: 0, max: 9, noNaN: true }), { nil: null }),
          }),
          async (testData) => {
            const dbAttempt = {
              _id: 'attempt-prop',
              sessionId: testData.sessionId,
              studentId: 'student-1',
              status: testData.status,
              moduleScores: {
                listening: testData.listening,
                reading: testData.reading,
                writing: testData.writing,
                speaking: testData.speaking,
                overall: null,
              },
              moduleResults: {},
              createdAt: new Date(),
            };

            const sortMock = jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(dbAttempt),
            });

            mockedAttemptModel.findOne.mockReturnValue({
              sort: sortMock,
            } as never);

            const response = await callRoute();
            const json = await response.json();

            // Verify round-trip correctness
            expect(json.sessionId).toBe(testData.sessionId);
            expect(json.status).toBe(testData.status);
            expect(json.moduleScores.listening).toBe(testData.listening);
            expect(json.moduleScores.reading).toBe(testData.reading);
            expect(json.moduleScores.writing).toBe(testData.writing);
            expect(json.moduleScores.speaking).toBe(testData.speaking);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property 10: Most recent attempt selection
     * Validates: Requirements 7.5
     * For any set of Active_Attempt documents with different createdAt values,
     * the returned attempt must have the maximum createdAt value
     */
    it('property: returns most recent attempt when multiple exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              sessionId: fc.string({ minLength: 10, maxLength: 30 }),
              createdAt: fc.date({ min: new Date('2026-01-01'), max: new Date('2026-12-31') }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (attempts) => {
            // Sort attempts by date to find the most recent
            const sortedAttempts = [...attempts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            const mostRecent = sortedAttempts[0];

            const sortMock = jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue({
                _id: 'attempt-recent',
                sessionId: mostRecent.sessionId,
                studentId: 'student-1',
                status: 'IN_PROGRESS',
                moduleScores: { listening: null, reading: null, writing: null, speaking: null, overall: null },
                moduleResults: {},
                createdAt: mostRecent.createdAt,
              }),
            });

            mockedAttemptModel.findOne.mockReturnValue({
              sort: sortMock,
            } as never);

            const response = await callRoute();
            const json = await response.json();

            // Verify that the response contains the most recent sessionId
            expect(json.sessionId).toBe(mostRecent.sessionId);

            // Verify that sort was called with { createdAt: -1 } (descending)
            expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
          }
        ),
        { numRuns: 15 }
      );
    });
  });
});
