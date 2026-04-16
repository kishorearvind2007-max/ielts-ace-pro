import { SignJWT, jwtVerify } from 'jose';
import { SESSION_MAX_AGE_SECONDS } from '@/lib/auth/constants';
import type { SessionUser } from '@/lib/auth/types';

const JWT_ALGORITHM = 'HS256';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET in environment variables.');
  }

  return new TextEncoder().encode(secret);
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    registerNumber: user.registerNumber,
    email: user.email,
    fullName: user.fullName,
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: [JWT_ALGORITHM],
    });

    if (typeof payload.sub !== 'string') {
      return null;
    }

    if (typeof payload.registerNumber !== 'string') {
      return null;
    }

    if (typeof payload.email !== 'string' || typeof payload.fullName !== 'string') {
      return null;
    }

    return {
      id: payload.sub,
      registerNumber: payload.registerNumber,
      email: payload.email,
      fullName: payload.fullName,
    };
  } catch {
    return null;
  }
}