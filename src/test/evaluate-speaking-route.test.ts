/** @jest-environment node */

describe('evaluate-speaking route', () => {
  const originalEnv = process.env;

  const PRIMARY_MODEL = 'moonshotai/kimi-k2-instruct-0905';
  const FALLBACK_MODEL = 'microsoft/phi-4-mini-flash-reasoning';

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NVIDIA_API_KEY: 'test-key',
      NVIDIA_SPEAKING_MODEL: PRIMARY_MODEL,
      NVIDIA_FALLBACK_MODEL: FALLBACK_MODEL,
    };
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  async function callRoute(payload: Record<string, unknown>) {
    const { POST } = await import('../app/api/evaluate-speaking/route');
    const req = {
      json: async () => payload,
    } as Request;

    return POST(req);
  }

  function mockNvidiaSuccess(content: string): Response {
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content,
            },
          },
        ],
      }),
      text: async () => '',
    } as unknown as Response;
  }

  it('returns normalized AI evaluation on successful response', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce(
      mockNvidiaSuccess(JSON.stringify({
        fluency_coherence: { band: 6.4, feedback: 'Mostly fluent response.', examples: ['Connected ideas well.'] },
        lexical_resource: { band: 6.1, feedback: 'Adequate range of vocabulary.', examples: ['Used topic vocabulary.'] },
        grammatical_range: { band: 5.9, feedback: 'Grammar is mostly controlled.', examples: ['Some complex clauses.'] },
        pronunciation: { band: 6.3, feedback: 'Pronunciation inferred from transcript.', inferred_from: 'Clear sentence rhythm in transcript.' },
        overall_band: 6.0,
        strengths: ['Clear structure'],
        improvements: ['Add wider vocabulary'],
        examiner_comment: 'Good attempt with room to improve precision.',
      })),
    );

    const response = await callRoute({
      fullTranscript: 'Part 1: I am from Chennai. Part 2: I describe a skill. Part 3: I discuss future skills.',
    });

    const json = await response.json();
    expect(json.evaluation_mode).toBe('ai');
    expect(json.model_used).toBe(PRIMARY_MODEL);
    expect(json.fluency_coherence.band).toBe(6.5);
    expect(json.pronunciation.inferred_from).toContain('Clear sentence rhythm');
    expect(json.word_count).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('parses fenced JSON responses from Nvidia', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce(
      mockNvidiaSuccess(`\`\`\`json
{
  "fluency_coherence": { "band": 6, "feedback": "Organized speech", "examples": ["Used linkers"] },
  "lexical_resource": { "band": 6, "feedback": "Good lexis", "examples": [] },
  "grammatical_range": { "band": 6, "feedback": "Decent grammar", "examples": [] },
  "pronunciation": { "band": 6, "feedback": "Transcript-based estimate", "examples": [], "inferred_from": "Stable phrasing" },
  "overall_band": 6,
  "strengths": ["Clear viewpoint"],
  "improvements": ["Add more examples"],
  "examiner_comment": "Solid response"
}
\`\`\``),
    );

    const response = await callRoute({
      fullTranscript: 'Part 1: Intro. Part 2: Story. Part 3: Discussion.',
    });
    const json = await response.json();

    expect(json.evaluation_mode).toBe('ai');
    expect(json.overall_band).toBe(6);
    expect(json.fluency_coherence.feedback).toBe('Organized speech');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries with fallback model when primary model fails', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        text: async () => 'primary failure',
      } as unknown as Response)
      .mockResolvedValueOnce(
        mockNvidiaSuccess(JSON.stringify({
          fluency_coherence: { band: 6, feedback: 'Fluent enough', examples: ['Logical flow'] },
          lexical_resource: { band: 6, feedback: 'Lexis is acceptable', examples: [] },
          grammatical_range: { band: 6, feedback: 'Grammar mostly accurate', examples: [] },
          pronunciation: { band: 6, feedback: 'Transcript-based estimate', examples: [], inferred_from: 'Stable pacing' },
          overall_band: 6,
          strengths: ['Coherent delivery'],
          improvements: ['Use more precise vocabulary'],
          examiner_comment: 'Good response overall',
        })),
      );

    const response = await callRoute({
      fullTranscript: 'Part 1: Intro. Part 2: Story. Part 3: Discussion.',
    });
    const json = await response.json();

    expect(json.evaluation_mode).toBe('ai');
    expect(json.model_used).toBe(FALLBACK_MODEL);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstPayload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const secondPayload = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(firstPayload.model).toBe(PRIMARY_MODEL);
    expect(secondPayload.model).toBe(FALLBACK_MODEL);
  });

  it('returns validation error when transcript is missing', async () => {
    const fetchMock = global.fetch as jest.Mock;

    const response = await callRoute({
      fullTranscript: '   ',
    });

    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe('fullTranscript is required');
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it('returns fallback evaluation when API key is missing', async () => {
    delete process.env.NVIDIA_API_KEY;

    const response = await callRoute({
      fullTranscript: 'Part 1: Basic intro response. Part 2: Main answer. Part 3: Follow-up discussion.',
    });

    const json = await response.json();
    expect(json.evaluation_mode).toBe('fallback');
    expect(json.model_used).toBe('word-count-fallback');
    expect(json.warning).toContain('Missing NVIDIA_API_KEY');
  });

  it('returns fallback evaluation when Nvidia requests fail', async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        text: async () => 'upstream failure 1',
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        text: async () => 'upstream failure 2',
      } as unknown as Response);

    const response = await callRoute({
      fullTranscript: 'Part 1: Intro. Part 2: Topic response. Part 3: Broader ideas.',
    });

    const json = await response.json();
    expect(json.evaluation_mode).toBe('fallback');
    expect(json.warning).toContain('Nvidia API error');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});