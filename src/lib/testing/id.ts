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
  const timestamp = now.getTime().toString(36).toUpperCase();
  return `TST-${buildDateStamp(now)}-${randomToken(4)}-${timestamp.slice(-4)}`;
}

export function generateCertificateId(now = new Date()): string {
  const timestamp = now.getTime().toString(36).toUpperCase();
  return `CERT-${buildDateStamp(now)}-${randomToken(4)}-${timestamp.slice(-4)}`;
}
