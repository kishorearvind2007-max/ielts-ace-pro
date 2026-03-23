export type TestModule = 'listening' | 'reading' | 'writing' | 'speaking';
export type TestPhase = 'home' | 'instructions' | 'test' | 'results';
export type QuestionType = 'mcq' | 'short-answer' | 'true-false-ng' | 'matching' | 'sentence-completion' | 'note-completion';

export interface Question {
  id: number;
  type: QuestionType;
  text: string;
  options?: string[];
  section?: number;
}

export interface ListeningSection {
  id: number;
  title: string;
  script: string;
  questions: Question[];
  answerKey: Record<number, string>;
}

export interface ReadingPassage {
  id: number;
  title: string;
  text: string;
  questions: Question[];
  answerKey: Record<number, string>;
}

export interface WritingTask {
  id: number;
  type: 'task1' | 'task2';
  prompt: string;
  minWords: number;
  recommendedMinutes: number;
  chartType?: 'bar' | 'line' | 'pie' | 'table' | 'process' | 'map';
  chartData?: {
    labels: string[];
    datasets: { label: string; data: number[] }[];
  };
}

export interface SpeakingPart {
  part: 1 | 2 | 3;
  questions: string[];
  cueCard?: {
    topic: string;
    points: string[];
    followUp: string;
  };
  prepTime?: number;
  speakTime?: number;
}

export interface ModuleResult {
  module: TestModule;
  band: number;
  rawScore?: number;
  totalQuestions?: number;
  answers?: Record<number, string>;
  criteriaScores?: Record<string, { band: number; feedback: string; examples: string[] }>;
  strengths?: string[];
  improvements?: string[];
  examinerComment?: string;
}

export interface TestState {
  phase: TestPhase;
  currentModule: TestModule | null;
  currentQuestion: number;
  currentSection: number;
  answers: Record<string, Record<number, string>>;
  writingResponses: { task1: string; task2: string };
  speakingTranscripts: { part1: string; part2: string; part3: string };
  results: ModuleResult[];
  timerSeconds: number;
  isTimerRunning: boolean;
  apiKey: string;
}

export type TestAction =
  | { type: 'SET_PHASE'; phase: TestPhase }
  | { type: 'SET_MODULE'; module: TestModule | null }
  | { type: 'SET_QUESTION'; question: number }
  | { type: 'SET_SECTION'; section: number }
  | { type: 'SET_ANSWER'; module: string; questionId: number; answer: string }
  | { type: 'SET_WRITING'; task: 'task1' | 'task2'; text: string }
  | { type: 'SET_SPEAKING_TRANSCRIPT'; part: 'part1' | 'part2' | 'part3'; text: string }
  | { type: 'ADD_RESULT'; result: ModuleResult }
  | { type: 'SET_TIMER'; seconds: number }
  | { type: 'SET_TIMER_RUNNING'; running: boolean }
  | { type: 'SET_API_KEY'; key: string }
  | { type: 'RESET' };
