import type { Certificate } from '@/lib/testing/certificate-model';
import type { TestSessionFinalScores } from '@/lib/testing/types';

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
  const fallbackScoresFromLegacy = (): TestSessionFinalScores => {
    const legacyBands = (certificate as CertificateLike & {
      moduleBands?: Partial<TestSessionFinalScores>;
      overallBand?: unknown;
    }).moduleBands ?? {};

    const normalizeBand = (value: unknown) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
      }

      return Math.max(0, Math.min(9, value));
    };

    const legacyOverall = (certificate as CertificateLike & { overallBand?: unknown }).overallBand;

    return {
      listening: normalizeBand(legacyBands.listening),
      reading: normalizeBand(legacyBands.reading),
      writing: normalizeBand(legacyBands.writing),
      speaking: normalizeBand(legacyBands.speaking),
      overallBand: normalizeBand(legacyOverall),
    };
  };

  const resolvedScores = certificate.scores ?? fallbackScoresFromLegacy();
  const resolvedSessionId = certificate.sessionId ?? certificate.testId ?? '';

  return {
    id: resolveStringId(certificate),
    certificateId: certificate.certificateId ?? '',
    sessionId: resolvedSessionId,
    testId: resolvedSessionId,
    fullName: certificate.fullName ?? '',
    registerNumber: certificate.registerNumber ?? '',
    scores: resolvedScores,
    moduleBands: {
      listening: resolvedScores.listening,
      reading: resolvedScores.reading,
      writing: resolvedScores.writing,
      speaking: resolvedScores.speaking,
    },
    overallBand: resolvedScores.overallBand,
    status: certificate.status ?? 'ISSUED',
    issuedAt: certificate.issuedAt ?? null,
    verificationUrl: certificate.verificationUrl ?? '',
  };
}
