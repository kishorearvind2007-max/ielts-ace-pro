import type { Certificate } from '@/lib/testing/certificate-model';

type CertificateLike = Partial<Certificate> & {
  _id?: { toString?: () => string };
  id?: string;
};

function resolveStringId(value: CertificateLike): string {
  if (typeof value.id === 'string' && value.id.length > 0) {
    return value.id;
  }

  if (value._id && typeof value._id.toString === 'function') {
    return value._id.toString();
  }

  return '';
}

export function toPublicCertificate(certificate: CertificateLike) {
  return {
    id: resolveStringId(certificate),
    certificateId: certificate.certificateId ?? '',
    testId: certificate.testId ?? '',
    fullName: certificate.fullName ?? '',
    registerNumber: certificate.registerNumber ?? '',
    moduleBands: certificate.moduleBands ?? {
      listening: 0,
      reading: 0,
      writing: 0,
      speaking: 0,
    },
    overallBand: certificate.overallBand ?? 0,
    status: certificate.status ?? 'ISSUED',
    issuedAt: certificate.issuedAt ?? null,
    verificationUrl: certificate.verificationUrl ?? '',
  };
}
