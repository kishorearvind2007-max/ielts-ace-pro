/** @jest-environment node */

jest.mock('@/lib/nvidia-api', () => ({
  generateWritingQuestions: jest.fn(),
}));

jest.mock('@/data/ielts-content', () => ({
  writingContent: [
    {
      id: 1,
      type: 'task1',
      prompt: 'Fallback task 1 prompt',
      minWords: 150,
      recommendedMinutes: 20,
      chartType: 'line',
      chartData: {
        labels: ['Jan', 'Feb'],
        datasets: [{ label: 'Series 1', data: [10, 20] }],
      },
    },
    {
      id: 2,
      type: 'task2',
      prompt: 'Fallback task 2 prompt',
      minWords: 250,
      recommendedMinutes: 40,
    },
  ],
}));

import { generateWritingQuestions } from '@/lib/nvidia-api';

describe('generate-writing-questions route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function callRoute(url = 'https://example.com/api/generate-writing-questions') {
    const { POST } = await import('../app/api/generate-writing-questions/route');
    const req = new Request(url, { method: 'POST' });
    return POST(req);
  }

  it('returns generated writing tasks with model metadata', async () => {
    const mockedGenerateWritingQuestions = generateWritingQuestions as jest.MockedFunction<typeof generateWritingQuestions>;

    mockedGenerateWritingQuestions.mockResolvedValueOnce({
      task1: {
        id: 1,
        type: 'task1',
        prompt: 'Generated task 1 prompt',
        minWords: 150,
        recommendedMinutes: 20,
        chartType: 'bar',
        chartData: {
          labels: ['A', 'B'],
          datasets: [{ label: 'Group 1', data: [20, 35] }],
        },
      },
      task2: {
        id: 2,
        type: 'task2',
        prompt: 'Generated task 2 prompt',
        minWords: 250,
        recommendedMinutes: 40,
      },
      modelUsed: 'google/gemma-4-31b-it',
    });

    const response = await callRoute('https://example.com/api/generate-writing-questions?difficulty=Band%207');
    const json = await response.json();

    expect(mockedGenerateWritingQuestions).toHaveBeenCalledWith('Band 7');
    expect(json.source).toBe('nvidia');
    expect(json.model_used).toBe('google/gemma-4-31b-it');
    expect(json.task1.prompt).toBe('Generated task 1 prompt');
    expect(json.task2.prompt).toBe('Generated task 2 prompt');
  });

  it('returns fallback tasks when generation fails', async () => {
    const mockedGenerateWritingQuestions = generateWritingQuestions as jest.MockedFunction<typeof generateWritingQuestions>;
    mockedGenerateWritingQuestions.mockRejectedValueOnce(new Error('Generation failed'));

    const response = await callRoute();
    const json = await response.json();

    expect(mockedGenerateWritingQuestions).toHaveBeenCalledWith('Band 6');
    expect(json.source).toBe('fallback');
    expect(json.model_used).toBe('fallback');
    expect(json.warning).toContain('Generation failed');
    expect(json.task1.type).toBe('task1');
    expect(json.task2.type).toBe('task2');
  });
});
