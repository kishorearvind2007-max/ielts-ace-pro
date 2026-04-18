export type TestModule = 'listening' | 'reading' | 'writing' | 'speaking';
export type TestPhase = 'home' | 'instructions' | 'test' | 'results';
export type QuestionType = 'mcq' | 'short-answer' | 'true-false-ng' | 'matching' | 'sentence-completion' | 'note-completion';
export type ContentSource = 'nvidia' | 'fallback';

export interface Question {
  id: number;
  type: QuestionType;
  text: string;
  options?: string[];
  section?: number;
}

export interface ListeningSectionMetadata {
  contentType?: 'conversation' | 'monologue' | 'academic' | 'lecture';
  estimatedDurationSeconds?: number;
  speakers?: string[];
}

export interface ListeningSection {
  id: number;
  title: string;
  script: string;
  questions: Question[];
  answerKey: Record<number, string>;
  source?: ContentSource;
  metadata?: ListeningSectionMetadata;
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

export interface CriterionScore {
  band: number;
  feedback: string;
  examples: string[];
}

export interface SpeakingEvaluationApiResponse {
  fluency_coherence: CriterionScore;
  lexical_resource: CriterionScore;
  grammatical_range: CriterionScore;
  pronunciation: CriterionScore & {
    inferred_from?: string;
  };
  overall_band: number;
  strengths: string[];
  improvements: string[];
  examiner_comment: string;
  evaluation_mode: 'ai' | 'fallback';
  model_used: string;
  warning?: string;
  word_count: number;
}

export interface SpeakingGenerationApiResponse {
  parts: SpeakingPart[];
  source: ContentSource;
  model_used: string;
  warning?: string;
}

export interface SpeakingResultSnapshot {
  band: number;
  criteriaScores: Record<string, CriterionScore>;
  strengths: string[];
  improvements: string[];
  examinerComment: string;
  transcripts: {
    part1: string;
    part2: string;
    part3: string;
  };
  evaluationMode: 'ai' | 'fallback';
  modelUsed: string;
  warning?: string;
  source?: ContentSource;
  submittedAt: string;
}

export interface WritingVocabularyExplanation {
  word: string;
  meaning: string;
  usage: string;
}

export interface WritingOverview {
  overview: string;
  strengths: string[];
  weaknesses: string[];
}

export interface WritingScoring {
  taskResponseHighLevel: string;
  taskResponseStrengths: string[];
  taskResponseWeaknesses: string[];
  coherenceHighLevel: string;
  coherenceStrengths: string[];
  coherenceWeaknesses: string[];
  taskResponseScore: number;
  coherenceScore: number;
}

export interface WritingLanguageAnalysis {
  correctedEssay: string;
  keyChanges: string[];
  lexicalResourceHighLevel: string;
  lexicalResourceStrengths: string[];
  lexicalResourceWeaknesses: string[];
  grammaticalRangeHighLevel: string;
  grammaticalRangeStrengths: string[];
  grammaticalRangeWeaknesses: string[];
  lexicalResourceScore: number;
  grammaticalRangeScore: number;
}

export interface WritingImprovement {
  improvedEssay: string;
  vocabularyExplanations: WritingVocabularyExplanation[];
  expandIdeas: string[];
  alternativeDirection: string;
  alternativeEssay: string;
  alternativeVocabulary: WritingVocabularyExplanation[];
}

export interface WritingEvaluationReport {
  overview: WritingOverview;
  scoring: WritingScoring;
  languageAnalysis: WritingLanguageAnalysis;
  improvement: WritingImprovement;
}

export interface WritingEvaluationApiResponse extends WritingEvaluationReport {
  evaluation_mode: 'ai' | 'fallback';
  model_used?: string;
  warning?: string;
  overall_band: number;
  word_count: number;
}

export interface WritingTaskEvaluations {
  task1: WritingEvaluationApiResponse;
  task2: WritingEvaluationApiResponse;
}

export type ListeningQuestionStatus = 'correct' | 'incorrect' | 'unanswered';

export interface ListeningQuestionValidation {
  questionId: number;
  sectionNumber: number;
  questionText: string;
  questionType: QuestionType;
  userAnswer: string;
  acceptedAnswers: string[];
  matchedAnswer?: string;
  status: ListeningQuestionStatus;
}

export interface ListeningSectionValidationSummary {
  sectionNumber: number;
  title?: string;
  correct: number;
  total: number;
}

export interface ListeningValidationSummary {
  generatedAt: string;
  rawScore: number;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  incorrectCount: number;
  sectionBreakdown: ListeningSectionValidationSummary[];
  questionResults: ListeningQuestionValidation[];
}

export interface ListeningResultSnapshot {
  band: number;
  rawScore: number;
  totalQuestions: number;
  sectionTitles: Record<number, string>;
  listeningValidation: ListeningValidationSummary;
  submittedAt: string;
}

export interface ModuleResult {
  module: TestModule;
  band: number;
  rawScore?: number;
  totalQuestions?: number;
  percentage?: number;
  answers?: Record<number, string>;
  listeningValidation?: ListeningValidationSummary;
  criteriaScores?: Record<string, CriterionScore>;
  strengths?: string[];
  improvements?: string[];
  examinerComment?: string;
  writingEvaluations?: WritingTaskEvaluations;
  // Advanced analytics (currently for reading)
  detailedResults?: {
    evaluations: Array<{
      questionId: number;
      isCorrect: boolean;
      matchMethod: string;
      userAnswer: string;
      correctAnswer: string;
      similarityScore?: number;
      timeSpent?: number;
    }>;
    questionTypes: Record<string, { correct: number; total: number }>;
    timeStats: {
      avgTimePerQuestion: number;
      fastestQuestion: { id: number; time: number } | null;
      slowestQuestion: { id: number; time: number } | null;
    };
  };
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
  | { type: 'LOAD_RESULTS'; results: ModuleResult[] }
  | { type: 'SET_TIMER'; seconds: number }
  | { type: 'SET_TIMER_RUNNING'; running: boolean }
  | { type: 'SET_API_KEY'; key: string }
  | { type: 'RESET' };
