/** @jest-environment node */

jest.mock('@/lib/auth/db', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/lib/auth/session', () => ({
  getSessionUserFromRequest: jest.fn(),
}));

jest.mock('@/lib/testing/test-attempt-model', () => ({
  TestAttemptModel: {
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
import { calculateOverallBand } from '@/lib/scoring';
import * as fc from 'fast-check';

function mockLeanQuery<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe('POST /api/test-attempts/[testId]/submit-module', () => {
  const mockedConnectToDatabase = connectToDatabase as jest.MockedFunction<typeof connectToDatabase>;
  const mockedGetSessionUserFromRequest = getSessionUserFromRequest as jest.MockedFunction<
    typeof getSessionUserFromRequest
  >;
  const mockedCalculateOverallBand = calculateOverallBand as jest.MockedFunction<typeof calculateOverallBand>;

  const mockedAttemptModel = TestAttemptModel as unknown as {
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

  async function callRoute(testId: string, body: unknown) {
    const { POST } = await import('../app/api/test-attempts/[testId]/submit-module/route');

    const request = {
      json: async () => body,
    } as unknown as Request;

    return POST(request as never, {
      params: { testId },
    });
  }

  describe('Authentication and Authorization Guards', () => {
    it('returns 401 when no auth token provided', async () => {
      mockedGetSessionUserFromRequest.mockResolvedValueOnce(null);

      const response = await callRoute('TST-123', {
        module: 'listening',
        band: 7.0,
        moduleResult: { module: 'listening', band: 7.0 },
      });

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe('UNAUTHORIZED');
    });

    it('returns 403 when authenticated user does not own the TestAttempt', async () => {
      mockedAttemptModel.findOne.mockReturnValueOnce(
        mockLeanQuery({
          _id: 'attempt-1',
          sessionId: 'TST-123',
          studentId: 'different-student-id',
          status: 'IN_PROGRESS',
          resultLocked: false,
          moduleScores: null,
        })
      );

      const response = await callRoute('TST-123', {
        module: 'listening',
        band: 7.0,
        moduleResult: { module: 'listening', band: 7.0 },
      });

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toBe('FORBIDDEN');
    });

    it('returns 400 (ALREADY_FINALIZED) when TestAttempt has resultLocked: true', async () => {
      mockedAttemptModel.findOne.mockReturnValueOnce(
        mockLeanQuery({
          _id: 'attempt-1',
          sessionId: 'TST-123',
          studentId: 'student-1',
          status: 'IN_PROGRESS',
          resultLocked: true,
          moduleScores: { listening: 7, reading: 7, writing: 7, speaking: 7, overall: 7 },
        })
      );

      const response = await callRoute('TST-123', {
        module: 'listening',
        band: 7.0,
        moduleResult: { module: 'listening', band: 7.0 },
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('ALREADY_FINALIZED');
    });

    it('returns 400 (ALREADY_FINALIZED) when TestAttempt status is COMPLETED', async () => {
      mockedAttemptModel.findOne.mockReturnValueOnce(
        mockLeanQuery({
          _id: 'attempt-1',
          sessionId: 'TST-123',
          studentId: 'student-1',
          status: 'COMPLETED',
          resultLocked: false,
          moduleScores: { listening: 7, reading: 7, writing: 7, speaking: 7, overall: 7 },
        })
      );

      const response = await callRoute('TST-123', {
        module: 'listening',
        band: 7.0,
        moduleResult: { module: 'listening', band: 7.0 },
      });

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toBe('ALREADY_FINALIZED');
    });
  });

  describe('Module Score Field Isolation', () => {
    it('updates only the target module score, leaving others unchanged', async () => {
      mockedAttemptModel.findOne.mockReturnValueOnce(
        mockLeanQuery({
          _id: 'attempt-1',
          sessionId: 'TST-123',
          studentId: 'student-1',
          status: 'IN_PROGRESS',
          resultLocked: false,
          moduleScores: { listening: 6.5, reading: null, writing: null, speaking: null, overall: null },
        })
      );

      mockedAttemptModel.findOneAndUpdate.mockReturnValueOnce(
        mockLeanQuery({
          _id: 'attempt-1',
          sessionId: 'TST-123',
          studentId: 'student-1',
          status: 'IN_PROGRESS',
          resultLocked: false,
          moduleScores: { listening: 6.5, reading: 7.0, writing: null, speaking: null, overall: null },
        })
      );

      const response = await callRoute('TST-123', {
        module: 'reading',
        band: 7.0,
        moduleResult: { module: 'reading', band: 7.0 },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.moduleScores.listening).toBe(6.5); // unchanged
      expect(json.moduleScores.reading).toBe(7.0); // updated
      expect(json.moduleScores.writing).toBeNull(); // unchanged
      expect(json.moduleScores.speaking).toBeNull(); // unchanged
    });

    /**
     * Property 2: Module score field isolation
     * Validates: Requirements 6.5, 8.4
     * For any module and valid band score, after submitting that module,
     * only that module's score should change; all others must remain at prior values
     */
    it('property: submitting one module does not affect other module scores', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('listening', 'reading', 'writing', 'speaking'),
          fc.double({ min: 0, max: 9, noNaN: true }),
          fc.double({ min: 0, max: 9, noNaN: true }),
          fc.double({ min: 0, max: 9, noNaN: true }),
          fc.constantFrom('listening', 'reading', 'writing', 'speaking'),
          fc.double({ min: 0, max: 9, noNaN: true }),
          async (module1, band1, band2, band3, targetModule, targetBand) => {
            // Create initial state with some modules filled
            const initialScores = {
              listening: null,
              reading: null,
              writing: null,
              speaking: null,
              overall: null,
            } as Record<string, number | null>;

            const modules = ['listening', 'reading', 'writing', 'speaking'];
            const otherModules = modules.filter((m) => m !== targetModule);

            // Set initial scores for other modules
            if (otherModules.length >= 1) initialScores[otherModules[0]] = band1;
            if (otherModules.length >= 2) initialScores[otherModules[1]] = band2;
            if (otherModules.length >= 3) initialScores[otherModules[2]] = band3;

            mockedAttemptModel.findOne.mockReturnValueOnce(
              mockLeanQuery({
                _id: 'attempt-prop',
                sessionId: 'TST-PROP',
                studentId: 'student-1',
                status: 'IN_PROGRESS',
                resultLocked: false,
                moduleScores: { ...initialScores },
              })
            );

            const expectedScores = { ...initialScores, [targetModule]: targetBand };

            mockedAttemptModel.findOneAndUpdate.mockReturnValueOnce(
              mockLeanQuery({
                _id: 'attempt-prop',
                sessionId: 'TST-PROP',
                studentId: 'student-1',
                status: 'IN_PROGRESS',
                resultLocked: false,
                moduleScores: expectedScores,
              })
            );

            const response = await callRoute('TST-PROP', {
              module: targetModule,
              band: targetBand,
              moduleResult: { module: targetModule, band: targetBand },
            });

            const json = await response.json();

            // Verify only the target module changed
            for (const mod of otherModules) {
              expect(json.moduleScores[mod]).toBe(initialScores[mod]);
            }
            expect(json.moduleScores[targetModule]).toBe(targetBand);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Auto-Finalization', () => {
    it('auto-finalizes when 4th module is submitted', async () => {
      mockedAttemptModel.findOne.mockReturnValueOnce(
        mockLeanQuery({
          _id: 'attempt-1',
          sessionId: 'TST-123',
          studentId: 'student-1',
          status: 'IN_PROGRESS',
          resultLocked: false,
          moduleScores: { listening: 7.0, reading: 6.5, writing: 6.5, speaking: null, overall: null },
          moduleResults: {
            listening: { band: 7.0 },
            reading: { band: 6.5 },
            writing: { band: 6.5 },
          },
        })
      );

      mockedCalculateOverallBand.mockReturnValue(7.0);

      mockedAttemptModel.findOneAndUpdate.mockReturnValueOnce(
        mockLeanQuery({
          _id: 'attempt-1',
          sessionId: 'TST-123',
          studentId: 'student-1',
          status: 'COMPLETED',
          resultLocked: true,
          moduleScores: { listening: 7.0, reading: 6.5, writing: 6.5, speaking: 7.0, overall: 7.0 },
          finalScores: {
            listening: 7.0,
            reading: 6.5,
            writing: 6.5,
            speaking: 7.0,
            overallBand: 7.0,
          },
          completedAt: new Date(),
        })
      );

      const response = await callRoute('TST-123', {
        module: 'speaking',
        band: 7.0,
        moduleResult: { module: 'speaking', band: 7.0 },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.status).toBe('COMPLETED');
      expect(json.moduleScores.overall).toBe(7.0);
      expect(mockedCalculateOverallBand).toHaveBeenCalledWith([7.0, 6.5, 6.5, 7.0]);
    });
  });
});
