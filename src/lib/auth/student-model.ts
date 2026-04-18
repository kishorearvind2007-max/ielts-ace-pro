import mongoose, { Schema, type HydratedDocument, type Model } from 'mongoose';
import { normalizeEmail, normalizeRegisterNumber } from '@/lib/auth/types';

export interface Student {
  registerNumber: string;
  email: string;
  fullName: string;
  passwordHash: string;
  googleSub?: string;
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
    googleSub: {
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
});

const StudentModel = (mongoose.models.Student as Model<Student> | undefined) ?? mongoose.model<Student>('Student', studentSchema);

export { StudentModel };