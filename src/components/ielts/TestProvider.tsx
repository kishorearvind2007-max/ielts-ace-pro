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

  const startModule = useCallback((module: TestModule) => {
    dispatch({ type: 'SET_MODULE', module });
    dispatch({ type: 'SET_PHASE', phase: 'test' });
    router.push(`/${module}`);
  }, [router]);

  const submitModule = useCallback((result: ModuleResult) => {
    dispatch({ type: 'ADD_RESULT', result });
    dispatch({ type: 'SET_PHASE', phase: 'home' });
    dispatch({ type: 'SET_MODULE', module: null });
    dispatch({ type: 'SET_TIMER_RUNNING', running: false });
    router.push('/');
  }, [router]);

  const goHome = useCallback(() => {
    dispatch({ type: 'SET_PHASE', phase: 'home' });
    dispatch({ type: 'SET_MODULE', module: null });
    router.push('/');
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
