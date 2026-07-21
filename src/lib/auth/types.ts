export interface SessionUser {
  id: string;
  registerNumber: string;
  email: string;
  fullName: string;
}

export interface PublicStudent {
  id: string;
  registerNumber: string;
  email: string;
  fullName: string;
  hasGoogleLinked: boolean;
}

export function normalizeRegisterNumber(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}