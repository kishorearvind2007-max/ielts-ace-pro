"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { AlertCircle, UserPlus } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sanitizeNextPath } from '@/lib/auth/navigation';

type RegisterResponse = {
  user?: {
    id: string;
    registerNumber: string;
    email: string;
    fullName: string;
    hasGoogleLinked: boolean;
  };
  message?: string;
};

function validateClientPassword(password: string): string {
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one number.';
  }

  return '';
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get('next')), [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    if (password !== confirmPassword) {
      setFormError('Password and confirm password do not match.');
      return;
    }

    const passwordError = validateClientPassword(password);
    if (passwordError) {
      setFormError(passwordError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName,
          registerNumber,
          email,
          password,
        }),
      });

      const payload = (await response.json()) as RegisterResponse;
      if (!response.ok || !payload.user) {
        setFormError(payload.message ?? 'Unable to create account right now.');
        return;
      }

      setUser(payload.user);
      router.push(nextPath);
      router.refresh();
    } catch {
      setFormError('Unable to create account right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl border-primary/20 bg-card/90 shadow-card">
      <CardHeader>
        <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
          <UserPlus className="h-4 w-4" />
          Create Student Account
        </div>
        <CardTitle className="text-3xl font-heading">Register</CardTitle>
        <CardDescription>
          Register number is required for account creation. You can log in later using register number + password or Google.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {formError && (
          <Alert variant="destructive" className="mb-5">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Could not create account</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              placeholder="Student full name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
              required
            />
          </div>

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
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@student.edu"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 chars, letter + number"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="md:col-span-2 mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Already registered?{' '}
              <Link href={`/auth/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </p>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}