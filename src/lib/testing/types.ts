import type {
  CriterionScore,
  ListeningSection,
  ListeningValidationSummary,
  ReadingPassage,
  SpeakingPart,
  WritingTask,
} from '@/lib/ielts-types';
import type { EvaluationResult } from '@/lib/advanced-scoring';

export type AttemptStatus = 'IN_PROGRESS' | 'COMPLETED' | 'VOID';
export type CertificateStatus = 'ISSUED';

export type AttemptModuleContent = {
  listeningSections: ListeningSection[];
  readingPassages: ReadingPassage[];
  writingTasks: WritingTask[];
  speakingParts: SpeakingPart[];
};

export type WritingResponses = {
  task1: string;
  task2: string;
};

export type SpeakingTranscripts = {
  part1: string;
  part2: string;
  part3: string;
};

export type AttemptSubmissionPayload = {
  listeningAnswers: Record<number, string>;
  readingAnswers: Record<number, string>;
  writingResponses: WritingResponses;
  speakingTranscripts: SpeakingTranscripts;
};

export type FinalizedListeningScore = {
  band: number;
  rawScore: number;
  totalQuestions: number;
  listeningValidation: ListeningValidationSummary;
};

export type FinalizedReadingScore = {
  band: number;
  rawScore: number;
  totalQuestions: number;
  percentage: number;
  detailedResults: EvaluationResult;
};

export type FinalizedWritingScore = {
  band: number;
  criteriaScores: Record<string, CriterionScore>;
  strengths: string[];
  improvements: string[];
  examinerComment: string;
  taskWordCounts: {
    task1: number;
    task2: number;
  };
};

export type FinalizedSpeakingScore = {
  band: number;
  criteriaScores: Record<string, CriterionScore>;
  strengths: string[];
  improvements: string[];
  examinerComment: string;
  transcriptWordCount: number;
};

export type FinalizedAttemptResult = {
  listening: FinalizedListeningScore;
  reading: FinalizedReadingScore;
  writing: FinalizedWritingScore;
  speaking: FinalizedSpeakingScore;
  overallBand: number;
};

export type ModuleBandBreakdown = {
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
};
