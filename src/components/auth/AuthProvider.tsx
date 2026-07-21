"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { PublicStudent } from '@/lib/auth/types';

type AuthContextValue = {
  user: PublicStudent | null;
  isLoading: boolean;
  refreshSession: () => Promise<PublicStudent | null>;
  setUser: (user: PublicStudent | null) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<PublicStudent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setUser = useCallback((nextUser: PublicStudent | null) => {
    setUserState(nextUser);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        setUserState(null);
        return null;
      }

      const payload = await response.json();
      const nextUser = (payload?.user ?? null) as PublicStudent | null;
      setUserState(nextUser);
      return nextUser;
    } catch {
      setUserState(null);
      return null;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      setUserState(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await refreshSession();
      if (!cancelled) {
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      refreshSession,
      setUser,
      signOut,
    }),
    [user, isLoading, refreshSession, setUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}