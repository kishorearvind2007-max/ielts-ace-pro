import React, { createContext, useContext, useReducer, useCallback } from 'react';
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
    case 'ADD_RESULT': return { ...state, results: [...state.results, action.result] };
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
}

const TestContext = createContext<TestContextType | null>(null);

export function TestProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(testReducer, initialState);

  const startModule = useCallback((module: TestModule) => {
    dispatch({ type: 'SET_MODULE', module });
    dispatch({ type: 'SET_PHASE', phase: 'test' });
  }, []);

  const submitModule = useCallback((result: ModuleResult) => {
    dispatch({ type: 'ADD_RESULT', result });
    dispatch({ type: 'SET_PHASE', phase: 'home' });
    dispatch({ type: 'SET_MODULE', module: null });
    dispatch({ type: 'SET_TIMER_RUNNING', running: false });
  }, []);

  const goHome = useCallback(() => {
    dispatch({ type: 'SET_PHASE', phase: 'home' });
    dispatch({ type: 'SET_MODULE', module: null });
  }, []);

  const showResults = useCallback(() => {
    dispatch({ type: 'SET_PHASE', phase: 'results' });
  }, []);

  return (
    <TestContext.Provider value={{ state, dispatch, startModule, submitModule, goHome, showResults }}>
      {children}
    </TestContext.Provider>
  );
}

export function useTest() {
  const ctx = useContext(TestContext);
  if (!ctx) throw new Error('useTest must be used within TestProvider');
  return ctx;
}
