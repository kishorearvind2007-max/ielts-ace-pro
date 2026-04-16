import type { PublicStudent, SessionUser } from '@/lib/auth/types';

type StudentLike = {
  _id?: unknown;
  id?: unknown;
  registerNumber?: unknown;
  email?: unknown;
  fullName?: unknown;
  googleSub?: unknown;
};

function resolveId(student: StudentLike): string {
  if (typeof student.id === 'string') {
    return student.id;
  }

  if (student._id && typeof student._id === 'object' && 'toString' in student._id) {
    const maybeToString = student._id.toString;
    if (typeof maybeToString === 'function') {
      return maybeToString.call(student._id);
    }
  }

  return '';
}

export function toSessionUser(student: StudentLike): SessionUser {
  return {
    id: resolveId(student),
    registerNumber: typeof student.registerNumber === 'string' ? student.registerNumber : '',
    email: typeof student.email === 'string' ? student.email : '',
    fullName: typeof student.fullName === 'string' ? student.fullName : '',
  };
}

export function toPublicStudent(student: StudentLike): PublicStudent {
  return {
    id: resolveId(student),
    registerNumber: typeof student.registerNumber === 'string' ? student.registerNumber : '',
    email: typeof student.email === 'string' ? student.email : '',
    fullName: typeof student.fullName === 'string' ? student.fullName : '',
    hasGoogleLinked: typeof student.googleSub === 'string' && student.googleSub.length > 0,
  };
}