import { z } from 'zod';

const answerRecordSchema = z.record(z.string().trim().min(1).max(250));

const writingResponsesSchema = z.object({
  task1: z.string().trim().min(1).max(10000),
  task2: z.string().trim().min(1).max(20000),
});

const speakingTranscriptsSchema = z.object({
  part1: z.string().trim().min(1).max(10000),
  part2: z.string().trim().min(1).max(10000),
  part3: z.string().trim().min(1).max(10000),
});

export const createTestAttemptSchema = z.object({
  difficulty: z.string().trim().min(1).max(50).optional(),
});

export const finalizeAttemptSchema = z.object({
  listeningAnswers: answerRecordSchema,
  readingAnswers: answerRecordSchema,
  writingResponses: writingResponsesSchema,
  speakingTranscripts: speakingTranscriptsSchema,
});

export const issueCertificateSchema = z.object({
  testId: z.string().trim().min(8).max(64),
});

const bandSchema = z.number().finite().min(0).max(9);

export const generateCertificateSchema = z.object({
  moduleBands: z.object({
    listening: bandSchema,
    reading: bandSchema,
    writing: bandSchema,
    speaking: bandSchema,
  }),
});

export const submitModuleSchema = z.object({
  module: z.enum(['listening', 'reading', 'writing', 'speaking']),
  band: z.number().finite().min(0).max(9),
  moduleResult: z.object({}).passthrough(),
});

export type CreateTestAttemptInput = z.infer<typeof createTestAttemptSchema>;
export type FinalizeAttemptInput = z.infer<typeof finalizeAttemptSchema>;
export type IssueCertificateInput = z.infer<typeof issueCertificateSchema>;
export type GenerateCertificateInput = z.infer<typeof generateCertificateSchema>;
export type SubmitModuleInput = z.infer<typeof submitModuleSchema>;

export function toNumericAnswerMap(value: Record<string, string>): Record<number, string> {
  const output: Record<number, string> = {};

  Object.entries(value).forEach(([rawQuestionId, answer]) => {
    const questionId = Number(rawQuestionId);
    if (!Number.isInteger(questionId) || questionId < 1) {
      return;
    }

    output[questionId] = answer.trim();
  });

  return output;
}
