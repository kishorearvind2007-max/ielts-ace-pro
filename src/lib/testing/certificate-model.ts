import mongoose, { Schema, type HydratedDocument, type Model, type Query } from 'mongoose';
import type { CertificateStatus, TestSessionFinalScores } from '@/lib/testing/types';

export interface Certificate {
  certificateId: string;
  sessionId: string;
  testId?: string;
  studentId: mongoose.Types.ObjectId;
  fullName: string;
  registerNumber: string;
  scores: TestSessionFinalScores;
  status: CertificateStatus;
  issuedAt: Date;
  verificationUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CertificateDocument = HydratedDocument<Certificate>;

const certificateSchema = new Schema<Certificate>(
  {
    certificateId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
      index: true,
    },
    testId: {
      type: String,
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
    fullName: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      maxlength: 80,
    },
    registerNumber: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      maxlength: 20,
    },
    scores: {
      type: Schema.Types.Mixed,
      required: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: ['ISSUED'],
      default: 'ISSUED',
      immutable: true,
      index: true,
    },
    issuedAt: {
      type: Date,
      required: true,
      immutable: true,
      default: () => new Date(),
    },
    verificationUrl: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

certificateSchema.index({ studentId: 1, issuedAt: -1 });

function blockCertificateMutation(this: Query<unknown, Certificate>) {
  throw new Error('Certificate records are immutable.');
}

certificateSchema.pre('updateOne', blockCertificateMutation);
certificateSchema.pre('updateMany', blockCertificateMutation);
certificateSchema.pre('findOneAndUpdate', blockCertificateMutation);
certificateSchema.pre('replaceOne', blockCertificateMutation);

certificateSchema.pre('save', function ensureImmutableOnSave() {
  if (!this.isNew && this.isModified()) {
    throw new Error('Certificate records are immutable.');
  }
});

const CertificateModel =
  (mongoose.models.Certificate as Model<Certificate> | undefined)
  ?? mongoose.model<Certificate>('Certificate', certificateSchema);

export { CertificateModel };
