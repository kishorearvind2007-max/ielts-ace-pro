import type { ModuleResult, TestModule } from '@/lib/ielts-types';
import { normalizeRegisterNumber } from '@/lib/auth/types';

export const DEMO_USER = {
  fullName: 'Demo Eligible Student',
  registerNumber: 'DEMO-CERT-001',
  email: 'demo.certificate.user@example.test',
  password: 'DemoPass123',
} as const;

export const DEMO_USER_MODULE_BANDS: Record<TestModule, number> = {
  listening: 6,
  reading: 6,
  writing: 6,
  speaking: 6,
};

export function isDemoEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function isDemoRegisterNumber(value: string | null | undefined): boolean {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  return normalizeRegisterNumber(value) === normalizeRegisterNumber(DEMO_USER.registerNumber);
}

export function isDemoCredentialInput(registerNumber: string, password: string): boolean {
  return isDemoEnabled() && isDemoRegisterNumber(registerNumber) && password === DEMO_USER.password;
}

export function buildDemoEligibleModuleResults(): ModuleResult[] {
  return [
    {
      module: 'listening',
      band: DEMO_USER_MODULE_BANDS.listening,
      rawScore: 30,
      totalQuestions: 40,
    },
    {
      module: 'reading',
      band: DEMO_USER_MODULE_BANDS.reading,
      rawScore: 30,
      totalQuestions: 40,
      percentage: 75,
    },
    {
      module: 'writing',
      band: DEMO_USER_MODULE_BANDS.writing,
      examinerComment: 'Demo profile seeded for certificate generation preview.',
    },
    {
      module: 'speaking',
      band: DEMO_USER_MODULE_BANDS.speaking,
      examinerComment: 'Demo profile seeded for certificate generation preview.',
    },
  ];
}
