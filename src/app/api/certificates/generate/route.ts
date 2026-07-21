import type { NextRequest } from 'next/server';
import { authError } from '@/lib/auth/http';

export const runtime = 'nodejs';

export async function POST(_request: NextRequest) {
  return authError(
    'DEPRECATED_ENDPOINT',
    'Local certificate generation is disabled. Issue certificates only from completed locked test sessions via /api/certificates/issue.',
    410,
  );
}
