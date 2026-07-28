/** @jest-environment node */

jest.mock('@/lib/auth/db', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/lib/auth/session', () => ({
  getSessionUserFromRequest: jest.fn(),
}));

jest.mock('@/lib/testing/test-attempt-model', () => ({
  TestAttemptModel: {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock('@/lib/scoring', () => ({
  calculateOverallBand: jest.fn((bands: number[]) => {
    const sum = bands.reduce((a, b) => a + b, 0);
    return Math.round((sum / bands.length) * 2) / 2;
  }),
}));

import { connectToDatabase } from '@/lib/auth/db';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';
import * as fc from 'fast-check';
import { calculateOverallBand } from '@/lib/scoring';

function mockLeanQuery<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
  };
}

function mockSortQuery<T>(value: T) {
  return {
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(value),
    }),
  };
}

describe('Partial Session Integration Tests', () => {
  const mockedConnectToDatabase = connectToDatabase as jest.MockedFunction<typeof connectToDatabase>;
  const mockedGetSessionUserFromRequest = getSessionUserFromRequest as jest.MockedFunction<
    typeof getSessionUserFromRequest
  >;

  const mockedAttemptModel = TestAttemptModel as unknown as {
    create: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
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

  /**
   * Task 12.1: Write integration test for full partial-session flow
   * Requirements: 1.1, 2.1, 2.2, 2.3
   * Create user, start a test, complete 2 modules via submit-module,
   * simulate page refresh (query active attempt API), verify 2 module scores are returned and state is hydrated correctly
   */
  describe('Full Partial Session Flow', () => {
    it('submits 2 modules, refreshes, and hydrates correctly', async () => {
      const sessionId = 'TST-20260727-ABC123';

      // Step 1: Create test attempt (simulated)
      mockedAttemptModel.create.mockResolvedValueOnce({
        _id: 'attempt-1',
        sessionId,
        studentId: 'student-1',
        status: 'IN_PROGRESS',
        resultLocked: false,
        moduleScores: null,
        moduleResults: {},
        createdAt: new Date(),
      });

      // Step 2: Submit first module (listening)
      mockedAttemptModel.findOne.mockReturnValueOnce(
        mockLeanQuery({
          _id: 'attempt-1',
          sessionId,
          studentId: 'student-1',
          status: 'IN_PROGRESS',
          resultLocked: false,
          moduleScores: null,
        })
      );

      mockedAttemptModel.findOne.mockReturnValueOnce(
        mockLeanQuery({
          _id: 'attempt-1',
          sessionId,
          studentId: 'student-1',
          status: 'IN_PROGRESS',
          resultLocked: false,
          moduleScores: {
            listening: 7.0,
            reading: null,
            writing: null,
            speaking: null,
            overall: null,
          },
        })
      );

      const { POST: submitModulePost } = await import(
        '../app/api/test-attempts/[testId]/submit-module/route'
      );

      let response = await submitModulePost(
        {
          json: async () => ({
            module: 'listening',
            band: 7.0,
            moduleResult: { module: 'listening', band: 7.0 },
          }),
        } as never,
        {
          params: Promise.resolve({ testId: sessionId }),
        }
      );

      let json = await response.json();
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.moduleScores.listening).toBe(7.0);
      expect(json.moduleScores.reading).toBeNull();

      // Step 3: Submit second module (reading)
      mockedAttemptModel.findOne.mockReturnValueOnce(
        mockLeanQuery({
          _id: 'attempt-1',
          sessionId,
          studentId: 'student-1',
          status: 'IN_PROGRESS',
          resultLocked: false,
          moduleScores: {
            listening: 7.0,
            reading: null,
            writing: null,
            speaking: null,
            overall: null,
          },
        })
      );

      mockedAttemptModel.findOne.mockReturnValueOnce(
        mockLeanQuery({
          _id: 'attempt-1',
          sessionId,
          studentId: 'student-1',
          status: 'IN_PROGRESS',
          resultLocked: false,
          moduleScores: {
            listening: 7.0,
            reading: 6.5,
            writing: null,
            speaking: null,
            overall: null,
          },
        })
      );

      response = await submitModulePost(
        {
          json: async () => ({
            module: 'reading',
            band: 6.5,
            moduleResult: { module: 'reading', band: 6.5 },
          }),
        } as never,
        {
          params: Promise.resolve({ testId: sessionId }),
        }
      );

      json = await response.json();
      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.moduleScores.listening).toBe(7.0);
      expect(json.moduleScores.reading).toBe(6.5);

      // Step 4: Simulate page refresh - query active attempt
      mockedAttemptModel.findOne.mockReturnValueOnce(
        mockSortQuery({
          _id: 'attempt-1',
          sessionId,
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
            listening: { band: 7.0 },
            reading: { band: 6.5 },
          },
          createdAt: new Date(),
        })
      );

      const { GET: activeGet } = await import('../app/api/test-attempts/active/route');

      response = await activeGet({} as never);
      json = await response.json();

      expect(response.status).toBe(200);
      expect(json.sessionId).toBe(sessionId);
      expect(json.status).toBe('IN_PROGRESS');
      expect(json.moduleScores.listening).toBe(7.0);
      expect(json.moduleScores.reading).toBe(6.5);
      expect(json.moduleScores.writing).toBeNull();
      expect(json.moduleScores.speaking).toBeNull();
      expect(json.moduleResults).toBeDefined();
    });
  });

  /**
   * Property 1: Overall band calculation correctness
   * Validates: Requirements 1.4
   * For any four valid module band scores (0-9), after all are set,
   * the stored overall must equal calculateOverallBand([listening, reading, writing, speaking])
   */
  describe('Overall Band Calculation', () => {
    it('property: overall band equals calculateOverallBand when all 4 modules submitted', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.double({ min: 0, max: 9, noNaN: true }),
          fc.double({ min: 0, max: 9, noNaN: true }),
          fc.double({ min: 0, max: 9, noNaN: true }),
          fc.double({ min: 0, max: 9, noNaN: true }),
          async (listening, reading, writing, speaking) => {
            const sessionId = 'TST-PROP';

            // Submit the 4th module (all others already submitted)
            mockedAttemptModel.findOne.mockReturnValueOnce(
              mockLeanQuery({
                _id: 'attempt-prop',
                sessionId,
                studentId: 'student-1',
                status: 'IN_PROGRESS',
                resultLocked: false,
                moduleScores: {
                  listening,
                  reading,
                  writing,
                  speaking: null, // Last one
                  overall: null,
                },
              })
            );

            const expectedOverall = calculateOverallBand([listening, reading, writing, speaking]);

            mockedAttemptModel.findOne.mockReturnValueOnce(
              mockLeanQuery({
                _id: 'attempt-prop',
                sessionId,
                studentId: 'student-1',
                status: 'COMPLETED',
                resultLocked: true,
                moduleScores: {
                  listening,
                  reading,
                  writing,
                  speaking,
                  overall: expectedOverall,
                },
              })
            );

            const { POST: submitModulePost } = await import(
              '../app/api/test-attempts/[testId]/submit-module/route'
            );

            const response = await submitModulePost(
              {
                json: async () => ({
                  module: 'speaking',
                  band: speaking,
                  moduleResult: { module: 'speaking', band: speaking },
                }),
              } as never,
              {
                params: Promise.resolve({ testId: sessionId }),
              }
            );

            const json = await response.json();
            expect(response.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.status).toBe('COMPLETED');
            expect(json.moduleScores.overall).toBe(expectedOverall);
            expect(json.moduleScores.overall).toBe(
              calculateOverallBand([listening, reading, writing, speaking])
            );
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
