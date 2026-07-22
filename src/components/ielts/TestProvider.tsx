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
    case 'SET_TIMER': return { ...state, timerSeconds: action.seconds };
    case 'SET_TIMER_RUNNING': return { ...state, isTimerRunning: action.running };
    case 'SET_API_KEY': return { ...state, apiKey: action.key };
    case 'SET_SESSION_ID': return { ...state, sessionId: action.sessionId };
    case 'RESET': return { ...initialState, apiKey: state.apiKey };
    default: return state;
  }
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

  const startModule = useCallback(async (module: TestModule) => {
    // Create test attempt in database if not already created (skip for demo users)
    const skipDatabase = isDemoEnabled() && user && isDemoRegisterNumber(user.registerNumber);
    
    if (!state.sessionId && !skipDatabase) {
      try {
        const response = await fetch('/api/test-attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ difficulty: 'Band 6' }),
        });

        if (response.ok) {
          const data = await response.json();
          dispatch({ type: 'SET_SESSION_ID', sessionId: data.sessionId });
          console.log('[TestProvider] Created test attempt:', data.sessionId);
        } else {
          console.error('[TestProvider] Failed to create test attempt');
        }
      } catch (error) {
        console.error('[TestProvider] Error creating test attempt:', error);
      }
    }

    dispatch({ type: 'SET_MODULE', module });
    dispatch({ type: 'SET_PHASE', phase: 'test' });
    router.push(`/${module}`);
  }, [router, state.sessionId, user]);

  const submitModule = useCallback(async (result: ModuleResult) => {
    dispatch({ type: 'ADD_RESULT', result });
    dispatch({ type: 'SET_PHASE', phase: 'home' });
    dispatch({ type: 'SET_MODULE', module: null });
    dispatch({ type: 'SET_TIMER_RUNNING', running: false });

    // Check if all 4 modules are completed
    const updatedResults = [...state.results.filter(r => r.module !== result.module), result];
    const completedModules = updatedResults.map(r => r.module);
    const allModulesCompleted = ['listening', 'reading', 'writing', 'speaking'].every(
      mod => completedModules.includes(mod as typeof result.module)
    );

    // Skip database finalization for demo users
    const skipDatabase = isDemoEnabled() && user && isDemoRegisterNumber(user.registerNumber);

    if (allModulesCompleted && state.sessionId && !skipDatabase) {
      // Finalize test in database
      try {
        const finalizePayload = {
          listeningAnswers: Object.fromEntries(
            Object.entries(state.answers.listening).map(([k, v]) => [k, String(v)])
          ),
          readingAnswers: Object.fromEntries(
            Object.entries(state.answers.reading).map(([k, v]) => [k, String(v)])
          ),
          writingResponses: state.writingResponses,
          speakingTranscripts: state.speakingTranscripts,
        };

        const response = await fetch(`/api/test-attempts/${state.sessionId}/finalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalizePayload),
        });

        if (response.ok) {
          console.log('[TestProvider] Test finalized successfully in database');
        } else {
          console.error('[TestProvider] Failed to finalize test:', await response.text());
        }
      } catch (error) {
        console.error('[TestProvider] Error finalizing test:', error);
      }
    }

    router.push('/dashboard');
  }, [router, state.results, state.sessionId, state.answers, state.writingResponses, state.speakingTranscripts, user]);

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
