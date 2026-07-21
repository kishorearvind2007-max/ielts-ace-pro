import crypto from 'node:crypto';

function buildDateStamp(input: Date): string {
  const year = input.getUTCFullYear();
  const month = String(input.getUTCMonth() + 1).padStart(2, '0');
  const day = String(input.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function randomToken(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex').toUpperCase();
}

export function generateTestId(now = new Date()): string {
  return `TST-${buildDateStamp(now)}-${randomToken(4)}`;
}

export function generateSessionId(now = new Date()): string {
  return generateTestId(now);
}

export function generateCertificateId(now = new Date()): string {
  return `CERT-${buildDateStamp(now)}-${randomToken(4)}`;
}
