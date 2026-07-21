/** @jest-environment node */

jest.mock('@/lib/auth/db', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/lib/auth/session', () => ({
  getSessionUserFromRequest: jest.fn(),
}));

jest.mock('@/lib/testing/finalize-service', () => ({
  finalizeAttemptFromSubmissions: jest.fn(),
}));

jest.mock('@/lib/testing/test-attempt-model', () => ({
  TestAttemptModel: {
    findOne: jest.fn(),
    updateOne: jest.fn(),
  },
}));

import { connectToDatabase } from '@/lib/auth/db';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { finalizeAttemptFromSubmissions } from '@/lib/testing/finalize-service';
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';

function mockLeanQuery<T>(value: T) {
  return {
    lean: jest.fn().mockResolvedValue(value),
  };
}

describe('test attempt finalize route', () => {
  const mockedConnectToDatabase = connectToDatabase as jest.MockedFunction<typeof connectToDatabase>;
  const mockedGetSessionUserFromRequest = getSessionUserFromRequest as jest.MockedFunction<typeof getSessionUserFromRequest>;
  const mockedFinalizeAttemptFromSubmissions = finalizeAttemptFromSubmissions as jest.MockedFunction<typeof finalizeAttemptFromSubmissions>;

  const mockedAttemptModel = TestAttemptModel as unknown as {
    findOne: jest.Mock;
    updateOne: jest.Mock;
  };

  const payload = {
    listeningAnswers: {
      '1': 'test',
    },
    readingAnswers: {
      '1': 'test',
    },
    writingResponses: {
      task1: 'Task 1 content that is long enough.',
      task2: 'Task 2 content that is long enough.',
    },
    speakingTranscripts: {
      part1: 'Part 1 transcript',
      part2: 'Part 2 transcript',
      part3: 'Part 3 transcript',
    },
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
    const { POST } = await import('../app/api/test-attempts/[testId]/finalize/route');

    const request = {
      json: async () => payload,
    } as unknown as Request;

    return POST(request as never, {
      params: {
        testId: 'TST-20260419-ABCDEF01',
      },
    });
  }

  it('finalizes an in-progress attempt and locks session scores', async () => {
    mockedAttemptModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: 'attempt-1',
      sessionId: 'TST-20260419-ABCDEF01',
      status: 'IN_PROGRESS',
      modules: {
        listeningSections: [],
        readingPassages: [],
        writingTasks: [],
        speakingParts: [],
      },
    }));

    mockedFinalizeAttemptFromSubmissions.mockReturnValue({
      listening: { band: 6, rawScore: 30, totalQuestions: 40, listeningValidation: {} as never },
      reading: { band: 6, rawScore: 30, totalQuestions: 40, percentage: 75, detailedResults: {} as never },
      writing: {
        band: 6,
        criteriaScores: {},
        strengths: [],
        improvements: [],
        examinerComment: '',
        taskWordCounts: { task1: 150, task2: 250 },
      },
      speaking: {
        band: 6,
        criteriaScores: {},
        strengths: [],
        improvements: [],
        examinerComment: '',
        transcriptWordCount: 180,
      },
      overallBand: 6,
    });

    mockedAttemptModel.updateOne.mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.alreadyFinalized).toBe(false);
    expect(json.result.sessionId).toBe('TST-20260419-ABCDEF01');
    expect(json.result.overallBand).toBe(6);
    expect(json.result.finalScores).toEqual({
      listening: 6,
      reading: 6,
      writing: 6,
      speaking: 6,
      overallBand: 6,
    });
    expect(mockedAttemptModel.updateOne).toHaveBeenCalledTimes(1);
  });

  it('returns idempotent response when session is already locked', async () => {
    mockedAttemptModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: 'attempt-locked',
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
      completedAt: new Date('2026-04-19T10:30:00.000Z'),
      moduleResults: {
        listening: { band: 7 },
        reading: { band: 7 },
        writing: { band: 7 },
        speaking: { band: 7 },
      },
    }));

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.alreadyFinalized).toBe(true);
    expect(json.result.overallBand).toBe(7);
    expect(mockedFinalizeAttemptFromSubmissions).not.toHaveBeenCalled();
    expect(mockedAttemptModel.updateOne).not.toHaveBeenCalled();
  });
});
