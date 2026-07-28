"use client";

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  buildDemoEligibleModuleResults,
  isDemoEnabled,
  isDemoRegisterNumber,
} from '@/lib/auth/demo-user';
import { TestState, TestAction, TestModule, ModuleResult } from '@/lib/ielts-types';
import type { ModuleScores } from '@/lib/testing/types';

const initialState: TestState = {
  phase: 'home',
  currentModule: null,
  currentQuestion: 0,
  currentSection: 0,
  answers: { listening: {}, reading: {} },
  writingResponses: { task1: '', task2: '' },
  speakingTranscripts: { part1: '', part2: '', part3: '' },
  results: [],
  timerSeconds: 0,
  isTimerRunning: false,
  apiKey: '',
  sessionId: null,
  sessionLoaded: false,
};

function testReducer(state: TestState, action: TestAction): TestState {
  switch (action.type) {
    case 'SET_PHASE': return { ...state, phase: action.phase };
    case 'SET_MODULE': return { ...state, currentModule: action.module, currentQuestion: 0, currentSection: 0 };
    case 'SET_QUESTION': return { ...state, currentQuestion: action.question };
    case 'SET_SECTION': return { ...state, currentSection: action.section };
    case 'SET_ANSWER': return {
      ...state,
      answers: {
        ...state.answers,
        [action.module]: { ...state.answers[action.module], [action.questionId]: action.answer },
      },
    };
    case 'SET_WRITING': return {
      ...state,
      writingResponses: { ...state.writingResponses, [action.task]: action.text },
    };
    case 'SET_SPEAKING_TRANSCRIPT': return {
      ...state,
      speakingTranscripts: { ...state.speakingTranscripts, [action.part]: action.text },
    };
    case 'ADD_RESULT': {
      // Prevent duplicate results for the same module
      const existingIndex = state.results.findIndex(r => r.module === action.result.module);
      if (existingIndex >= 0) {
        const newResults = [...state.results];
        newResults[existingIndex] = action.result;
        return { ...state, results: newResults };
      }
      return { ...state, results: [...state.results, action.result] };
    }
    case 'LOAD_RESULTS': return { ...state, results: action.results };
    case 'LOAD_SESSION': {
      // Idempotence guard: if already loaded, ignore subsequent dispatches
      if (state.sessionLoaded) return state;
      return {
        ...state,
        sessionId: action.sessionId,
        results: action.results,
        sessionLoaded: true,
      };
    }
    case 'SET_SESSION_LOADED': return { ...state, sessionLoaded: action.loaded };
    case 'SET_TIMER': return { ...state, timerSeconds: action.seconds };
    case 'SET_TIMER_RUNNING': return { ...state, isTimerRunning: action.running };
    case 'SET_API_KEY': return { ...state, apiKey: action.key };
    case 'SET_SESSION_ID': return { ...state, sessionId: action.sessionId };
    case 'RESET': return { ...initialState, apiKey: state.apiKey };
    default: return state;
  }
}

/** Map a ModuleScores object (from API) into ModuleResult[] for local state hydration. */
function mapModuleScoresToResults(
  moduleScores: ModuleScores,
  moduleResults?: Record<string, unknown>,
): ModuleResult[] {
  const results: ModuleResult[] = [];
  const modules: (keyof Omit<ModuleScores, 'overall'>)[] = ['listening', 'reading', 'writing', 'speaking'];

  for (const mod of modules) {
    const band = moduleScores[mod];
    if (band === null || band === undefined) continue;

    const raw = moduleResults?.[mod] as Record<string, unknown> | undefined;
    results.push({
      module: mod as TestModule,
      band,
      rawScore: typeof raw?.rawScore === 'number' ? raw.rawScore : undefined,
      totalQuestions: typeof raw?.totalQuestions === 'number' ? raw.totalQuestions : undefined,
      criteriaScores: raw?.criteriaScores as ModuleResult['criteriaScores'],
      strengths: Array.isArray(raw?.strengths) ? (raw!.strengths as string[]) : undefined,
      improvements: Array.isArray(raw?.improvements) ? (raw!.improvements as string[]) : undefined,
      examinerComment: typeof raw?.examinerComment === 'string' ? raw.examinerComment : undefined,
    });
  }

  return results;
}

interface TestContextType {
  state: TestState;
  dispatch: React.Dispatch<TestAction>;
  startModule: (module: TestModule) => void;
  submitModule: (result: ModuleResult) => void;
  goHome: () => void;
  showResults: () => void;
  resetAll: () => void;
}

const TestContext = createContext<TestContextType | null>(null);

export function TestProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [state, dispatch] = useReducer(testReducer, initialState);

  // Use a ref to track sessionId so callbacks always have the latest value
  const sessionIdRef = React.useRef<string | null>(null);

  // Keep ref in sync with state
  React.useEffect(() => {
    sessionIdRef.current = state.sessionId;
  }, [state.sessionId]);

  // Demo mode: pre-load demo results
  useEffect(() => {
    if (!isDemoEnabled()) {
      return;
    }

    if (!isDemoRegisterNumber(user?.registerNumber)) {
      return;
    }

    if (state.results.length > 0) {
      return;
    }

    dispatch({
      type: 'LOAD_RESULTS',
      results: buildDemoEligibleModuleResults(),
    });
  }, [state.results.length, user?.registerNumber]);

  // Session hydration: on mount, fetch the user's active attempt and load saved scores
  useEffect(() => {
    const isDemoUser = isDemoEnabled() && user && isDemoRegisterNumber(user.registerNumber);
    if (!user || isDemoUser || state.sessionLoaded) return;

    const loadSession = async () => {
      try {
        console.log('[TestProvider] Loading active session...');
        const response = await fetch('/api/test-attempts/active');
        if (!response.ok) {
          console.log('[TestProvider] No active session found');
          dispatch({ type: 'SET_SESSION_LOADED', loaded: true });
          return;
        }

        const data = await response.json() as {
          sessionId: string | null;
          moduleScores: ModuleScores | null;
          moduleResults?: Record<string, unknown>;
        };

        console.log('[TestProvider] Active session data:', data);

        if (data.sessionId && data.moduleScores) {
          const results = mapModuleScoresToResults(data.moduleScores, data.moduleResults);
          console.log('[TestProvider] Hydrated results:', results);
          dispatch({ type: 'LOAD_SESSION', sessionId: data.sessionId, results });
          // Also update the ref
          sessionIdRef.current = data.sessionId;
        } else {
          console.log('[TestProvider] No moduleScores to hydrate');
          dispatch({ type: 'SET_SESSION_LOADED', loaded: true });
        }
      } catch (error) {
        console.error('[TestProvider] Failed to load active attempt:', error);
        dispatch({ type: 'SET_SESSION_LOADED', loaded: true });
      }
    };

    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const startModule = useCallback(async (module: TestModule) => {
    // Create test attempt in database if not already created (skip for demo users)
    const skipDatabase = isDemoEnabled() && user && isDemoRegisterNumber(user.registerNumber);

    if (!sessionIdRef.current && !skipDatabase && user) {
      try {
        const response = await fetch('/api/test-attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ difficulty: 'Band 6' }),
        });

        if (response.ok) {
          const data = await response.json();
          const newSessionId = data.sessionId;
          dispatch({ type: 'SET_SESSION_ID', sessionId: newSessionId });
          sessionIdRef.current = newSessionId;
          console.log('[TestProvider] Created test attempt:', newSessionId);
        } else {
          console.error('[TestProvider] Failed to create test attempt:', await response.text());
        }
      } catch (error) {
        console.error('[TestProvider] Error creating test attempt:', error);
      }
    }

    dispatch({ type: 'SET_MODULE', module });
    dispatch({ type: 'SET_PHASE', phase: 'test' });
    router.push(`/${module}`);
  }, [router, user]);

  const submitModule = useCallback(async (result: ModuleResult) => {
    // Add result to local state first
    dispatch({ type: 'ADD_RESULT', result });
    dispatch({ type: 'SET_PHASE', phase: 'home' });
    dispatch({ type: 'SET_MODULE', module: null });
    dispatch({ type: 'SET_TIMER_RUNNING', running: false });

    // Skip database submission for demo users
    const skipDatabase = isDemoEnabled() && user && isDemoRegisterNumber(user.registerNumber);

    // Per-module fire-and-forget persistence (Requirement 10.4, 1.1)
    // Use the ref to get the latest sessionId
    const currentSessionId = sessionIdRef.current;

    console.log('[TestProvider] submitModule called:', {
      module: result.module,
      band: result.band,
      sessionId: currentSessionId,
      skipDatabase,
      hasUser: !!user,
    });

    if (!skipDatabase && currentSessionId) {
      console.log('[TestProvider] Submitting module score to API...');

      try {
        const response = await fetch(`/api/test-attempts/${currentSessionId}/submit-module`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            module: result.module,
            band: result.band,
            moduleResult: result,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[TestProvider] ✅ Module score submitted successfully:', data);
        } else {
          const errorText = await response.text();
          console.error('[TestProvider] ❌ Failed to submit module score:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
        }
      } catch (error) {
        console.error('[TestProvider] ❌ Network error submitting module score:', error);
      }
    } else if (!skipDatabase && !currentSessionId) {
      console.warn('[TestProvider] ⚠️  No sessionId available to submit module score. Module:', result.module);
      console.warn('[TestProvider] This likely means the test session was not created properly.');
    } else if (skipDatabase) {
      console.log('[TestProvider] Skipping database submission (demo user)');
    }

    router.push('/dashboard');
  }, [router, user]);

  const goHome = useCallback(() => {
    dispatch({ type: 'SET_PHASE', phase: 'home' });
    dispatch({ type: 'SET_MODULE', module: null });
    router.push('/dashboard');
  }, [router]);

  const showResults = useCallback(() => {
    dispatch({ type: 'SET_PHASE', phase: 'results' });
    router.push('/results');
  }, [router]);

  const resetAll = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return (
    <TestContext.Provider value={{ state, dispatch, startModule, submitModule, goHome, showResults, resetAll }}>
      {children}
    </TestContext.Provider>
  );
}

export function useTest() {
  const ctx = useContext(TestContext);
  if (!ctx) throw new Error('useTest must be used within TestProvider');
  return ctx;
}
