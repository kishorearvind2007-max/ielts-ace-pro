import { submitModuleSchema } from './validators';
import type { SubmitModuleInput } from './validators';

describe('submitModuleSchema', () => {
  it('should accept valid listening module submission', () => {
    const validInput = {
      module: 'listening' as const,
      band: 7.5,
      moduleResult: { score: 7.5, details: 'test data' },
    };

    const result = submitModuleSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.module).toBe('listening');
      expect(result.data.band).toBe(7.5);
    }
  });

  it('should accept valid reading module submission', () => {
    const validInput = {
      module: 'reading' as const,
      band: 6.0,
      moduleResult: { correctAnswers: 30 },
    };

    const result = submitModuleSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept valid writing module submission', () => {
    const validInput = {
      module: 'writing' as const,
      band: 8.0,
      moduleResult: { task1: 8.0, task2: 8.0 },
    };

    const result = submitModuleSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept valid speaking module submission', () => {
    const validInput = {
      module: 'speaking' as const,
      band: 7.0,
      moduleResult: { fluency: 7.0, lexical: 7.0 },
    };

    const result = submitModuleSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept band score of 0', () => {
    const validInput = {
      module: 'listening' as const,
      band: 0,
      moduleResult: {},
    };

    const result = submitModuleSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept band score of 9', () => {
    const validInput = {
      module: 'listening' as const,
      band: 9,
      moduleResult: {},
    };

    const result = submitModuleSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept empty moduleResult object', () => {
    const validInput = {
      module: 'listening' as const,
      band: 7.5,
      moduleResult: {},
    };

    const result = submitModuleSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('should accept moduleResult with any properties (passthrough)', () => {
    const validInput = {
      module: 'listening' as const,
      band: 7.5,
      moduleResult: {
        customField1: 'value',
        customField2: 123,
        nested: { field: true },
      },
    };

    const result = submitModuleSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.moduleResult).toEqual({
        customField1: 'value',
        customField2: 123,
        nested: { field: true },
      });
    }
  });

  it('should reject invalid module name', () => {
    const invalidInput = {
      module: 'invalid',
      band: 7.5,
      moduleResult: {},
    };

    const result = submitModuleSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should reject band score below 0', () => {
    const invalidInput = {
      module: 'listening' as const,
      band: -0.5,
      moduleResult: {},
    };

    const result = submitModuleSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should reject band score above 9', () => {
    const invalidInput = {
      module: 'listening' as const,
      band: 9.5,
      moduleResult: {},
    };

    const result = submitModuleSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should reject non-finite band scores', () => {
    const invalidInput = {
      module: 'listening' as const,
      band: Infinity,
      moduleResult: {},
    };

    const result = submitModuleSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should reject NaN band scores', () => {
    const invalidInput = {
      module: 'listening' as const,
      band: NaN,
      moduleResult: {},
    };

    const result = submitModuleSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should reject missing module field', () => {
    const invalidInput = {
      band: 7.5,
      moduleResult: {},
    };

    const result = submitModuleSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should reject missing band field', () => {
    const invalidInput = {
      module: 'listening' as const,
      moduleResult: {},
    };

    const result = submitModuleSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should reject missing moduleResult field', () => {
    const invalidInput = {
      module: 'listening' as const,
      band: 7.5,
    };

    const result = submitModuleSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it('should type-check SubmitModuleInput', () => {
    // This test verifies the type inference works correctly
    const input: SubmitModuleInput = {
      module: 'listening',
      band: 7.5,
      moduleResult: { any: 'data' },
    };

    expect(input.module).toBe('listening');
    expect(input.band).toBe(7.5);
  });
});
