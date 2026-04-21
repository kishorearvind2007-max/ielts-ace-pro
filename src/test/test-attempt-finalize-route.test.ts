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

jest.mock('@/lib/testing/test-result-model', () => ({
  TestResultModel: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

import { connectToDatabase } from '@/lib/auth/db';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { finalizeAttemptFromSubmissions } from '@/lib/testing/finalize-service';
import { TestAttemptModel } from '@/lib/testing/test-attempt-model';
import { TestResultModel } from '@/lib/testing/test-result-model';

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

  const mockedResultModel = TestResultModel as unknown as {
    findOne: jest.Mock;
    create: jest.Mock;
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

  it('finalizes an in-progress attempt and persists immutable result', async () => {
    mockedResultModel.findOne.mockReturnValueOnce(mockLeanQuery(null));
    mockedAttemptModel.findOne.mockReturnValueOnce(mockLeanQuery({
      _id: 'attempt-1',
      testId: 'TST-20260419-ABCDEF01',
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

    mockedResultModel.create.mockResolvedValue({
      testId: 'TST-20260419-ABCDEF01',
      overallBand: 6,
      completedAt: new Date('2026-04-19T10:00:00.000Z'),
      modules: {
        listening: { band: 6 },
        reading: { band: 6 },
        writing: { band: 6 },
        speaking: { band: 6 },
      },
    });

    mockedAttemptModel.updateOne.mockResolvedValue({ acknowledged: true, matchedCount: 1, modifiedCount: 1 });

    const response = await callRoute();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.alreadyFinalized).toBe(false);
    expect(json.result.overallBand).toBe(6);
    expect(mockedResultModel.create).toHaveBeenCalledTimes(1);
    expect(mockedAttemptModel.updateOne).toHaveBeenCalledTimes(1);
  });

  it('returns idempotent response when a result already exists', async () => {
    mockedResultModel.findOne.mockReturnValueOnce(mockLeanQuery({
      testId: 'TST-20260419-ABCDEF01',
      overallBand: 7,
      completedAt: new Date('2026-04-19T10:30:00.000Z'),
      modules: {
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
    expect(mockedResultModel.create).not.toHaveBeenCalled();
  });
});
