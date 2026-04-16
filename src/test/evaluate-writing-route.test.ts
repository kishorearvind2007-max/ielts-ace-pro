/** @jest-environment node */

describe('evaluate-writing route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NVIDIA_API_KEY: 'test-key',
      NVIDIA_MODEL: 'mistralai/mistral-small-3.1-24b-instruct-2503',
      NVIDIA_FALLBACK_MODEL: 'microsoft/phi-4-mini-flash-reasoning',
    };
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  async function callRoute(payload: Record<string, unknown>) {
    const { POST } = await import('../app/api/evaluate-writing/route');
    const req = {
      json: async () => payload,
    } as Request;

    return POST(req);
  }

  function mockFetchSuccess(content: string): Response {
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: { content },
          },
        ],
      }),
      text: async () => '',
    } as unknown as Response;
  }

  function buildAiResponse(score: number) {
    return {
      overview: {
        overview: 'Overall response is clear and relevant.',
        strengths: ['Clear focus'],
        weaknesses: ['Some points can be expanded'],
      },
      scoring: {
        taskResponseHighLevel: 'Task is mostly addressed.',
        taskResponseStrengths: ['Main points are present'],
        taskResponseWeaknesses: ['Support can be deeper'],
        coherenceHighLevel: 'Paragraph flow is generally logical.',
        coherenceStrengths: ['Logical order'],
        coherenceWeaknesses: ['Transitions can be smoother'],
        taskResponseScore: score,
        coherenceScore: score,
      },
      languageAnalysis: {
        correctedEssay: 'Corrected essay text.',
        keyChanges: ['Fixed verb agreement'],
        lexicalResourceHighLevel: 'Vocabulary is adequate.',
        lexicalResourceStrengths: ['Relevant vocabulary'],
        lexicalResourceWeaknesses: ['More precise collocations needed'],
        grammaticalRangeHighLevel: 'Grammar is mostly controlled.',
        grammaticalRangeStrengths: ['Mostly accurate sentences'],
        grammaticalRangeWeaknesses: ['More complex forms needed'],
        lexicalResourceScore: score,
        grammaticalRangeScore: score,
      },
      improvement: {
        improvedEssay: 'Improved essay text.',
        vocabularyExplanations: [
          { word: 'cohesive', meaning: 'well connected', usage: 'Use cohesive links.' },
        ],
        expandIdeas: ['Add a concrete example.'],
        alternativeDirection: 'Use a balanced viewpoint.',
        alternativeEssay: 'Alternative essay text.',
        alternativeVocabulary: [
          { word: 'nuanced', meaning: 'subtle and precise', usage: 'A nuanced argument.' },
        ],
      },
    };
  }

  it('uses primary model on success', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce(
      mockFetchSuccess(JSON.stringify(buildAiResponse(7))),
    );

    const response = await callRoute({
      taskType: 'Task 2 (Essay)',
      essay: 'This is an essay with enough words to evaluate properly.',
      wordCount: 260,
    });

    const json = await response.json();
    expect(json.evaluation_mode).toBe('ai');
    expect(json.model_used).toBe('mistralai/mistral-small-3.1-24b-instruct-2503');
    expect(json.word_count).toBe(260);

    const firstCallBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(firstCallBody.model).toBe('mistralai/mistral-small-3.1-24b-instruct-2503');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to secondary model when primary fails', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockRejectedValueOnce(new Error('Primary model unavailable'))
      .mockResolvedValueOnce(
        mockFetchSuccess(JSON.stringify(buildAiResponse(6))),
      );

    const response = await callRoute({
      taskType: 'Task 2 (Essay)',
      essay: 'Another essay text for fallback flow.',
      wordCount: 250,
    });

    const json = await response.json();
    expect(json.evaluation_mode).toBe('ai');
    expect(json.model_used).toBe('microsoft/phi-4-mini-flash-reasoning');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstCallBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(firstCallBody.model).toBe('mistralai/mistral-small-3.1-24b-instruct-2503');
    expect(secondCallBody.model).toBe('microsoft/phi-4-mini-flash-reasoning');
  });

  it('returns word-count fallback when both AI models fail', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockRejectedValueOnce(new Error('Primary model failed'))
      .mockRejectedValueOnce(new Error('Fallback model failed'));

    const response = await callRoute({
      taskType: 'Task 1 (Academic - describe a graph)',
      essay: 'Short response.',
      wordCount: 50,
    });

    const json = await response.json();
    expect(json.evaluation_mode).toBe('fallback');
    expect(json.model_used).toBe('word-count-fallback');
    expect(json.warning).toContain('Fallback model failed');
    expect(json.overall_band).toBeGreaterThanOrEqual(0);
    expect(json.overall_band).toBeLessThanOrEqual(9);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
