"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { AlertCircle, GraduationCap, LogIn } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEMO_USER, isDemoEnabled } from '@/lib/auth/demo-user';
import { sanitizeNextPath } from '@/lib/auth/navigation';

type LoginResponse = {
  user?: {
    id: string;
    registerNumber: string;
    email: string;
    fullName: string;
    hasGoogleLinked: boolean;
  };
  message?: string;
};

const oauthErrorMessages: Record<string, string> = {
  account_not_found: 'No account found for this Google email. Create your account first using register number.',
  oauth_state_mismatch: 'Google sign-in session expired. Please try Continue with Google again.',
  oauth_code_missing: 'Google sign-in failed to return an authorization code. Please try again.',
  google_email_not_verified: 'Your Google email is not verified. Please verify it and try again.',
  google_account_mismatch: 'This account is already linked to a different Google profile.',
  oauth_failed: 'Google sign-in failed. Please try again.',
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();

  const [registerNumber, setRegisterNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get('next')), [searchParams]);
  const googleHref = useMemo(
    () => `/api/auth/google/start?next=${encodeURIComponent(nextPath)}`,
    [nextPath],
  );

  const oauthErrorCode = searchParams.get('error');
  const oauthError = oauthErrorCode ? oauthErrorMessages[oauthErrorCode] : '';
  const showDemoCredentials = isDemoEnabled();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ registerNumber, password }),
      });

      const payload = (await response.json()) as LoginResponse;
      if (!response.ok || !payload.user) {
        setFormError(payload.message ?? 'Unable to sign in with register number and password.');
        return;
      }

      setUser(payload.user);
      router.push(nextPath);
      router.refresh();
    } catch {
      setFormError('Unable to sign in right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid w-full max-w-4xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <Card className="border-primary/20 bg-card/90 shadow-card">
        <CardHeader>
          <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
            <GraduationCap className="h-4 w-4" />
            Student Sign In
          </div>
          <CardTitle className="text-3xl font-heading">Welcome Back</CardTitle>
          <CardDescription>
            Sign in using your register number and password, or continue with Google.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {(oauthError || formError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Sign-in issue</AlertTitle>
              <AlertDescription>{oauthError || formError}</AlertDescription>
            </Alert>
          )}

          {showDemoCredentials && (
            <div className="rounded-lg border border-success/40 bg-success/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-success mb-2">Development Demo Account</p>
              <div className="space-y-1 text-sm text-foreground">
                <p>Register Number: <span className="font-mono font-semibold">{DEMO_USER.registerNumber}</span></p>
                <p>Password: <span className="font-mono font-semibold">{DEMO_USER.password}</span></p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                This account is available only in non-production environments and is preloaded as certificate-eligible.
              </p>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="registerNumber">Register Number</Label>
              <Input
                id="registerNumber"
                placeholder="e.g. CSE-2026-0142"
                value={registerNumber}
                onChange={(event) => setRegisterNumber(event.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              <LogIn className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button variant="outline" className="w-full" asChild>
            <a href={googleHref}>Continue with Google</a>
          </Button>

          <p className="text-sm text-muted-foreground">
            New student?{' '}
            <Link href={`/auth/register?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-primary hover:underline">
              Create account
            </Link>
          </p>
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-primary/15 bg-card/70 p-8 shadow-card">
        <h2 className="mb-3 text-2xl font-heading font-bold text-foreground">Before You Start</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Your student account keeps IELTS progress private and enables secure access to all test modules.
        </p>
        <ul className="space-y-3 text-sm text-foreground">
          <li>• Use your official register number when creating your account.</li>
          <li>• After registration, you can sign in with register number + password.</li>
          <li>• You can also continue with Google after account creation.</li>
        </ul>
      </div>
    </div>
  );
}