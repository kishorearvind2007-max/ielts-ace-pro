import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { sanitizeNextPath } from '@/lib/auth/navigation';

type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in environment variables.`);
  }

  return value;
}

export function createOAuthState(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function buildGoogleAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getRequiredEnv('GOOGLE_OAUTH_CLIENT_ID'),
    redirect_uri: getRequiredEnv('GOOGLE_OAUTH_REDIRECT_URI'),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCodeForIdToken(code: string): Promise<string> {
  const params = new URLSearchParams({
    code,
    client_id: getRequiredEnv('GOOGLE_OAUTH_CLIENT_ID'),
    client_secret: getRequiredEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
    redirect_uri: getRequiredEnv('GOOGLE_OAUTH_REDIRECT_URI'),
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token exchange failed: ${errorText}`);
  }

  const tokenPayload = await response.json();
  if (!tokenPayload?.id_token || typeof tokenPayload.id_token !== 'string') {
    throw new Error('Google token exchange returned invalid id_token.');
  }

  return tokenPayload.id_token;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const clientId = getRequiredEnv('GOOGLE_OAUTH_CLIENT_ID');
  const client = new OAuth2Client(clientId);

  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error('Google token payload is missing required claims.');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: Boolean(payload.email_verified),
    name: payload.name ?? '',
  };
}

export { sanitizeNextPath };