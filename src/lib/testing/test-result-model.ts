import mongoose, { Schema, type HydratedDocument, type Model, type Query } from 'mongoose';
import type { FinalizedAttemptResult } from '@/lib/testing/types';

export interface TestResult {
  testId: string;
  studentId: mongoose.Types.ObjectId;
  attemptId: mongoose.Types.ObjectId;
  status: 'COMPLETED';
  modules: FinalizedAttemptResult;
  overallBand: number;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type TestResultDocument = HydratedDocument<TestResult>;

const testResultSchema = new Schema<TestResult>(
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
      immutable: true,
      ref: 'Student',
      index: true,
    },
    attemptId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
      ref: 'TestAttempt',
      index: true,
    },
    status: {
      type: String,
      enum: ['COMPLETED'],
      default: 'COMPLETED',
      immutable: true,
      index: true,
    },
    modules: {
      type: Schema.Types.Mixed,
      required: true,
      immutable: true,
    },
    overallBand: {
      type: Number,
      required: true,
      immutable: true,
      min: 0,
      max: 9,
    },
    completedAt: {
      type: Date,
      required: true,
      immutable: true,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
  },
);

testResultSchema.index({ studentId: 1, completedAt: -1 });

function blockResultMutation(this: Query<unknown, TestResult>) {
  throw new Error('TestResult records are immutable.');
}

testResultSchema.pre('updateOne', blockResultMutation);
testResultSchema.pre('updateMany', blockResultMutation);
testResultSchema.pre('findOneAndUpdate', blockResultMutation);
testResultSchema.pre('replaceOne', blockResultMutation);

testResultSchema.pre('save', function ensureImmutableOnSave() {
  if (!this.isNew && this.isModified()) {
    throw new Error('TestResult records are immutable.');
  }
});

const TestResultModel =
  (mongoose.models.TestResult as Model<TestResult> | undefined)
  ?? mongoose.model<TestResult>('TestResult', testResultSchema);

export { TestResultModel };
