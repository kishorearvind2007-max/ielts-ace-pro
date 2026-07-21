import mongoose, { Schema, type HydratedDocument, type Model } from 'mongoose';
import { normalizeEmail, normalizeRegisterNumber } from '@/lib/auth/types';

export interface Student {
  registerNumber: string;
  email: string;
  fullName: string;
  passwordHash: string;
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type StudentDocument = HydratedDocument<Student>;

const studentSchema = new Schema<Student>(
  {
    registerNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    googleId: {
      type: String,
      default: '',
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

studentSchema.pre('validate', function normalizeIdentityFields() {
  if (this.registerNumber) {
    this.registerNumber = normalizeRegisterNumber(this.registerNumber);
  }
  if (this.email) {
    this.email = normalizeEmail(this.email);
  }

  const legacyGoogleSub = (this as Student & { googleSub?: string }).googleSub;
  if (!this.googleId && typeof legacyGoogleSub === 'string' && legacyGoogleSub.length > 0) {
    this.googleId = legacyGoogleSub;
  }
});

studentSchema.virtual('googleSub')
  .get(function getLegacyGoogleSubAlias(this: Student) {
    return this.googleId ?? '';
  })
  .set(function setLegacyGoogleSubAlias(this: Student, value: unknown) {
    if (typeof value === 'string') {
      this.googleId = value;
    }
  });

const StudentModel = (mongoose.models.Student as Model<Student> | undefined) ?? mongoose.model<Student>('Student', studentSchema);

export { StudentModel };