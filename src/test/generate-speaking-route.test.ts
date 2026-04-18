/** @jest-environment node */

jest.mock('@/lib/nvidia-api', () => ({
  generateSpeakingQuestions: jest.fn(),
}));

jest.mock('@/data/ielts-content', () => ({
  speakingContent: [
    {
      part: 1,
      questions: ['Fallback part 1 question'],
    },
    {
      part: 2,
      questions: ['Fallback part 2 question'],
      cueCard: {
        topic: 'Fallback cue card topic',
        points: ['Point 1', 'Point 2', 'Point 3', 'Point 4'],
        followUp: 'Fallback follow-up question',
      },
      prepTime: 60,
      speakTime: 120,
    },
    {
      part: 3,
      questions: ['Fallback part 3 question'],
    },
  ],
}));

import { generateSpeakingQuestions } from '@/lib/nvidia-api';

describe('generate-speaking-questions route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function callRoute(url = 'https://example.com/api/generate-speaking-questions') {
    const { POST } = await import('../app/api/generate-speaking-questions/route');
    const req = new Request(url, { method: 'POST' });
    return POST(req);
  }

  it('returns generated speaking prompts with model metadata', async () => {
    const mockedGenerateSpeakingQuestions = generateSpeakingQuestions as jest.MockedFunction<typeof generateSpeakingQuestions>;

    mockedGenerateSpeakingQuestions.mockResolvedValueOnce({
      parts: [
        {
          part: 1,
          questions: ['Generated part 1 question A', 'Generated part 1 question B'],
        },
        {
          part: 2,
          questions: ['Generated part 2 question'],
          cueCard: {
            topic: 'Generated cue card topic',
            points: ['Point A', 'Point B', 'Point C', 'Point D'],
            followUp: 'Generated follow-up question',
          },
          prepTime: 60,
          speakTime: 120,
        },
        {
          part: 3,
          questions: ['Generated part 3 question A', 'Generated part 3 question B'],
        },
      ],
      modelUsed: 'moonshotai/kimi-k2-instruct-0905',
    });

    const response = await callRoute('https://example.com/api/generate-speaking-questions?difficulty=Band%207');
    const json = await response.json();

    expect(mockedGenerateSpeakingQuestions).toHaveBeenCalledWith('Band 7');
    expect(json.source).toBe('nvidia');
    expect(json.model_used).toBe('moonshotai/kimi-k2-instruct-0905');
    expect(Array.isArray(json.parts)).toBe(true);
    expect(json.parts[1].cueCard.topic).toBe('Generated cue card topic');
  });

  it('returns fallback speaking prompts when generation fails', async () => {
    const mockedGenerateSpeakingQuestions = generateSpeakingQuestions as jest.MockedFunction<typeof generateSpeakingQuestions>;
    mockedGenerateSpeakingQuestions.mockRejectedValueOnce(new Error('Speaking generation failed'));

    const response = await callRoute();
    const json = await response.json();

    expect(mockedGenerateSpeakingQuestions).toHaveBeenCalledWith('Band 6');
    expect(json.source).toBe('fallback');
    expect(json.model_used).toBe('fallback');
    expect(json.warning).toContain('Speaking generation failed');
    expect(Array.isArray(json.parts)).toBe(true);
    expect(json.parts).toHaveLength(3);
  });
});