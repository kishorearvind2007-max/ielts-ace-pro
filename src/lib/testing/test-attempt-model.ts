import mongoose, { Schema, type HydratedDocument, type Model } from 'mongoose';
import type { AttemptModuleContent, AttemptStatus, SpeakingTranscripts, WritingResponses } from '@/lib/testing/types';

type AttemptSubmissions = {
  listeningAnswers: Record<number, string>;
  readingAnswers: Record<number, string>;
  writingResponses: WritingResponses;
  speakingTranscripts: SpeakingTranscripts;
};

export interface TestAttempt {
  testId: string;
  studentId: mongoose.Types.ObjectId;
  difficulty: string;
  status: AttemptStatus;
  modules: AttemptModuleContent;
  submissions: AttemptSubmissions;
  finalizedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type TestAttemptDocument = HydratedDocument<TestAttempt>;

function defaultSubmissions(): AttemptSubmissions {
  return {
    listeningAnswers: {},
    readingAnswers: {},
    writingResponses: {
      task1: '',
      task2: '',
    },
    speakingTranscripts: {
      part1: '',
      part2: '',
      part3: '',
    },
  };
}

const testAttemptSchema = new Schema<TestAttempt>(
  {
    testId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Student',
      index: true,
    },
    difficulty: {
      type: String,
      required: true,
      default: 'Band 6',
      trim: true,
      maxlength: 50,
    },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED', 'VOID'],
      default: 'IN_PROGRESS',
      index: true,
    },
    modules: {
      type: Schema.Types.Mixed,
      required: true,
    },
    submissions: {
      type: Schema.Types.Mixed,
      required: true,
      default: defaultSubmissions,
    },
    finalizedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

testAttemptSchema.index({ studentId: 1, status: 1 });
testAttemptSchema.index({ studentId: 1, createdAt: -1 });

const TestAttemptModel =
  (mongoose.models.TestAttempt as Model<TestAttempt> | undefined)
  ?? mongoose.model<TestAttempt>('TestAttempt', testAttemptSchema);

export { TestAttemptModel };
