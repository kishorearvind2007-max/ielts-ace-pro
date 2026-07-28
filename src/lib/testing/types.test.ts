import type { ModuleScores } from './types';

describe('ModuleScores type', () => {
  it('should allow all nullable fields', () => {
    const scores: ModuleScores = {
      listening: null,
      reading: null,
      writing: null,
      speaking: null,
      overall: null,
    };

    expect(scores).toBeDefined();
  });

  it('should allow numeric values for all fields', () => {
    const scores: ModuleScores = {
      listening: 6.5,
      reading: 7.0,
      writing: 6.0,
      speaking: 7.5,
      overall: 7.0,
    };

    expect(scores.listening).toBe(6.5);
    expect(scores.reading).toBe(7.0);
    expect(scores.writing).toBe(6.0);
    expect(scores.speaking).toBe(7.5);
    expect(scores.overall).toBe(7.0);
  });

  it('should allow mixed null and numeric values', () => {
    const scores: ModuleScores = {
      listening: 6.5,
      reading: 7.0,
      writing: null,
      speaking: null,
      overall: null,
    };

    expect(scores.listening).toBe(6.5);
    expect(scores.reading).toBe(7.0);
    expect(scores.writing).toBeNull();
    expect(scores.speaking).toBeNull();
    expect(scores.overall).toBeNull();
  });
});
