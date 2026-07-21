import { calculateOverallBand } from '@/lib/scoring';
import type { ModuleBandBreakdown } from '@/lib/testing/types';

export const CERTIFICATE_MIN_BAND_THRESHOLD = 2;

type EligibilityCriterion = keyof ModuleBandBreakdown | 'overall';

type CertificateEligibilityInput = {
  moduleBands: Partial<ModuleBandBreakdown> | null | undefined;
  overallBand?: unknown;
};

export type CertificateEligibilityResult = {
  qualified: boolean;
  threshold: number;
  moduleBands: ModuleBandBreakdown;
  overallBand: number;
  failedCriteria: EligibilityCriterion[];
};

function normalizeBand(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(9, value));
}

function formatCriterion(criterion: EligibilityCriterion): string {
  if (criterion === 'overall') {
    return 'Overall';
  }

  return criterion.charAt(0).toUpperCase() + criterion.slice(1);
}

export function normalizeModuleBandBreakdown(value: Partial<ModuleBandBreakdown> | null | undefined): ModuleBandBreakdown {
  const source = value ?? {};

  return {
    listening: normalizeBand(source.listening),
    reading: normalizeBand(source.reading),
    writing: normalizeBand(source.writing),
    speaking: normalizeBand(source.speaking),
  };
}

export function evaluateCertificateEligibility(input: CertificateEligibilityInput): CertificateEligibilityResult {
  const moduleBands = normalizeModuleBandBreakdown(input.moduleBands);
  const computedOverallBand = calculateOverallBand([
    moduleBands.listening,
    moduleBands.reading,
    moduleBands.writing,
    moduleBands.speaking,
  ]);

  const overallBand = input.overallBand === undefined
    ? computedOverallBand
    : normalizeBand(input.overallBand);

  const failedCriteria: EligibilityCriterion[] = [];

  if (moduleBands.listening < CERTIFICATE_MIN_BAND_THRESHOLD) {
    failedCriteria.push('listening');
  }
  if (moduleBands.reading < CERTIFICATE_MIN_BAND_THRESHOLD) {
    failedCriteria.push('reading');
  }
  if (moduleBands.writing < CERTIFICATE_MIN_BAND_THRESHOLD) {
    failedCriteria.push('writing');
  }
  if (moduleBands.speaking < CERTIFICATE_MIN_BAND_THRESHOLD) {
    failedCriteria.push('speaking');
  }
  if (overallBand < CERTIFICATE_MIN_BAND_THRESHOLD) {
    failedCriteria.push('overall');
  }

  return {
    qualified: failedCriteria.length === 0,
    threshold: CERTIFICATE_MIN_BAND_THRESHOLD,
    moduleBands,
    overallBand,
    failedCriteria,
  };
}

export function buildCertificateEligibilityMessage(result: CertificateEligibilityResult): string {
  if (result.qualified) {
    return `Eligible: all module and overall bands are >= ${result.threshold}.`;
  }

  const failedText = result.failedCriteria.map(formatCriterion).join(', ');
  return `Certificate requires a minimum band of ${result.threshold} in Listening, Reading, Writing, Speaking, and Overall. Criteria not met: ${failedText}.`;
}
