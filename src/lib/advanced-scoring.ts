/**
 * Advanced Scoring Engine for IELTS Reading Module
 * Includes fuzzy matching, pattern recognition, and detailed analytics
 */

import { rawToBand, roundIELTS } from './scoring';

// ============================================
// TEXT NORMALIZATION & PATTERN MATCHING
// ============================================

/**
 * Normalize phone numbers: remove spaces, dashes, parentheses, etc.
 */
export function normalizePhoneNumber(str: string): string {
  return str.replace(/[\s\-\(\)]/g, '').toLowerCase();
}

/**
 * Check if string is numeric (includes decimals, fractions, percentages)
 */
export function isNumeric(str: string): boolean {
  const cleaned = str.replace(/[^\d.,%\/-]/g, '');
  return cleaned.length > 0 && !isNaN(Number(cleaned.replace(/,/g, '')));
}

/**
 * Normalize numbers: standardize format
 */
export function normalizeNumber(str: string): string {
  let normalized = str.toLowerCase().trim();
  // Remove commas from numbers
  normalized = normalized.replace(/,/g, '');
  // Standardize fraction notation
  normalized = normalized.replace(/\s+\/\s+/g, '/');
  return normalized;
}

/**
 * Normalize dates to a standard format
 */
export function normalizeDate(str: string): string {
  const s = str.toLowerCase().trim();

  const monthMap: Record<string, string> = {
    'jan': '01', 'january': '01',
    'feb': '02', 'february': '02',
    'mar': '03', 'march': '03',
    'apr': '04', 'april': '04',
    'may': '05',
    'jun': '06', 'june': '06',
    'jul': '07', 'july': '07',
    'aug': '08', 'august': '08',
    'sep': '09', 'september': '09',
    'oct': '10', 'october': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'december': '12'
  };

  let result = s;

  // Handle "1st of September" → "1 09"
  result = result.replace(/(\d+)(st|nd|rd|th)?\s+of\s+(\w+)/i, (match, day, suffix, month) => {
    const monthNum = monthMap[month.toLowerCase()];
    return monthNum ? `${day} ${monthNum}` : match;
  });

  // Handle "1st September" or "1st Sept" (ordinal + month)
  for (const [monthName, monthNum] of Object.entries(monthMap)) {
    const pattern = new RegExp(`(\\d+)(st|nd|rd|th)?\\s+${monthName}\\b`, 'i');
    const match = result.match(pattern);
    if (match) {
      result = `${match[1]} ${monthNum}`;
      break;
    }
  }

  // Handle "September 1" or "Sept 1" (month + day)
  for (const [monthName, monthNum] of Object.entries(monthMap)) {
    const pattern = new RegExp(`${monthName}\\s+(\\d+)`, 'i');
    const match = result.match(pattern);
    if (match) {
      result = `${match[1]} ${monthNum}`;
      break;
    }
  }

  // Remove leading zeros from day for flexibility
  result = result.replace(/^0+(\d)/, '$1');

  return result;
}

/**
 * Normalize text for general comparison
 */
export function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

// ============================================
// LEVENSHTEIN DISTANCE & SIMILARITY
// ============================================

/**
 * Calculate Levenshtein distance between two strings
 * Minimum number of single-character edits to change one string into another
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Create matrix: (b.length + 1) x (a.length + 1)
  const matrix: number[][] = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  // Fill matrix
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0-1)
 * Uses Levenshtein distance relative to longer string length
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

// ============================================
// ANSWER MATCHING WITH MULTIPLE STRATEGIES
// ============================================

export interface MatchResult {
  match: boolean;
  method: 'exact' | 'alternate' | 'phone-normalized' | 'numeric-normalized' | 'date-normalized' | 'fuzzy' | 'none' | 'empty';
  score?: number; // Only for fuzzy matches
}

/**
 * Comprehensive answer matching with multiple strategies
 */
export function answersMatch(userAnswer: string, correctAnswer: string, options: {
  fuzzyThreshold?: number;
  enablePatternMatching?: boolean;
  enableFuzzy?: boolean;
} = {}): MatchResult {
  const {
    fuzzyThreshold = 0.85,  // High threshold for IELTS (85% similarity)
    enablePatternMatching = true,
    enableFuzzy = true
  } = options;

  const user = userAnswer.trim();
  const correct = correctAnswer.trim();

  if (!user || !correct) {
    return { match: false, method: 'empty' };
  }

  // 1. Exact match (case-sensitive after normalization)
  if (user === correct) {
    return { match: true, method: 'exact' };
  }

  // Case-insensitive exact
  if (user.toLowerCase() === correct.toLowerCase()) {
    return { match: true, method: 'exact' };
  }

  // 2. Check multiple acceptable answers (pipe-separated)
  const acceptableAnswers = correct.split('|').map(a => a.trim().toLowerCase());
  if (acceptableAnswers.includes(user.toLowerCase())) {
    return { match: true, method: 'alternate' };
  }

  // 3. Pattern-based matching
  if (enablePatternMatching) {
    // Phone numbers (various formats)
    const userIsPhone = /^[\d\s\-\(\)+]+$/.test(user) && user.replace(/\D/g, '').length >= 7;
    const correctIsPhone = /^[\d\s\-\(\)+]+$/.test(correct) && correct.replace(/\D/g, '').length >= 7;
    if (userIsPhone && correctIsPhone) {
      const normUser = normalizePhoneNumber(user);
      const normCorrect = normalizePhoneNumber(correct);
      if (normUser === normCorrect) {
        return { match: true, method: 'phone-normalized' };
      }
    }

    // Numbers/dates (both are numeric)
    const userIsNumeric = isNumeric(user);
    const correctIsNumeric = isNumeric(correct);
    if (userIsNumeric && correctIsNumeric) {
      const normUser = normalizeNumber(user);
      const normCorrect = normalizeNumber(correct);
      if (normUser === normCorrect) {
        return { match: true, method: 'numeric-normalized' };
      }

      // Date matching - if both contain month names or day/month patterns
      const hasMonth = /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(user) ||
                       /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(correct);
      const hasDatePattern = /\d+.*\d+|(\d+)(st|nd|rd|th)/i.test(user) || /\d+.*\d+|(\d+)(st|nd|rd|th)/i.test(correct);

      if (hasMonth || hasDatePattern) {
        const normUserDate = normalizeDate(user);
        const normCorrectDate = normalizeDate(correct);
        if (normUserDate === normCorrectDate) {
          return { match: true, method: 'date-normalized' };
        }
      }
    }
  }

  // 4. Fuzzy matching (spelling tolerance)
  if (enableFuzzy && user.length >= 3 && correct.length >= 3) {
    // Only apply fuzzy matching to strings of reasonable length
    // Avoid fuzzy matching numbers/dates (already normalized above)
    const similarity = stringSimilarity(user.toLowerCase(), correct.toLowerCase());
    if (similarity >= fuzzyThreshold) {
      return { match: true, method: 'fuzzy', score: similarity };
    }
  }

  return { match: false, method: 'none' };
}

// ============================================
// DETAILED EVALUATION & ANALYTICS
// ============================================

export interface AnswerEvaluation {
  questionId: number;
  isCorrect: boolean;
  matchMethod: string;
  userAnswer: string;
  correctAnswer: string;
  similarityScore?: number;
  timeSpent?: number; // in seconds
}

export interface EvaluationResult {
  rawScore: number;
  totalQuestions: number;
  percentage: number;
  band: number;
  evaluations: AnswerEvaluation[];
  questionTypes: Record<string, { correct: number; total: number }>;
  timeStats: {
    avgTimePerQuestion: number;
    fastestQuestion: { id: number; time: number } | null;
    slowestQuestion: { id: number; time: number } | null;
  };
}

/**
 * Advanced evaluation with comprehensive analytics
 *
 * @param userAnswers Map of question ID to user's answer
 * @param answerKey Map of question ID to correct answer(s) (pipe-separated for multiples)
 * @param questionTypes Map of question ID to question type (e.g., 'mcq', 'short-answer')
 * @param questionTimes Map of question ID to time spent in seconds
 */
export function evaluateAnswersAdvanced(
  userAnswers: Record<number, string>,
  answerKey: Record<number, string>,
  questionTypes: Record<number, string> = {},
  questionTimes?: Record<number, number>
): EvaluationResult {
  const evaluations: AnswerEvaluation[] = [];
  const questionTypesStats: Record<string, { correct: number; total: number }> = {};

  for (const [qId, correctAnswer] of Object.entries(answerKey)) {
    const questionId = Number(qId);
    const userAnswer = userAnswers[questionId] || '';
    const qType = questionTypes[questionId] || 'unknown';

    // Initialize stats for this question type
    if (!questionTypesStats[qType]) {
      questionTypesStats[qType] = { correct: 0, total: 0 };
    }
    questionTypesStats[qType].total++;

    const result = answersMatch(userAnswer, correctAnswer, {
      fuzzyThreshold: 0.85,  // Higher threshold for IELTS (85% similarity)
      enablePatternMatching: true,
      enableFuzzy: true
    });

    if (result.match) {
      questionTypesStats[qType].correct++;
    }

    evaluations.push({
      questionId,
      isCorrect: result.match,
      matchMethod: result.method,
      userAnswer,
      correctAnswer,
      similarityScore: result.score,
      timeSpent: questionTimes?.[questionId],
    });
  }

  const rawScore = evaluations.filter(e => e.isCorrect).length;
  const totalQuestions = Object.keys(answerKey).length;
  const percentage = (rawScore / totalQuestions) * 100;
  const band = rawToBand(rawScore);

  // Calculate time statistics
  const timesWithValues = evaluations
    .map(e => e.timeSpent)
    .filter((t): t is number => t !== undefined && t !== null && t > 0);

  const avgTimePerQuestion = timesWithValues.length > 0
    ? timesWithValues.reduce((a, b) => a + b, 0) / timesWithValues.length
    : 0;

  // Find fastest and slowest
  let fastest: { id: number; time: number } | null = null;
  let slowest: { id: number; time: number } | null = null;

  evaluations.forEach(e => {
    if (e.timeSpent && e.timeSpent > 0) {
      if (fastest === null || e.timeSpent < fastest.time) {
        fastest = { id: e.questionId, time: e.timeSpent };
      }
      if (slowest === null || e.timeSpent > slowest.time) {
        slowest = { id: e.questionId, time: e.timeSpent };
      }
    }
  });

  const timeStats = {
    avgTimePerQuestion,
    fastestQuestion: fastest,
    slowestQuestion: slowest,
  };

  return {
    rawScore,
    totalQuestions,
    percentage,
    band,
    evaluations,
    questionTypes: questionTypesStats,
    timeStats,
  };
}

// ============================================
// HELPER: Generate question type map from passages
// ============================================

/**
 * Create a question type map from an array of passages/reading sections
 */
export function buildQuestionTypeMap(
  passages: Array<{ questions: Array<{ id: number; type: string }> }>
): Record<number, string> {
  const typeMap: Record<number, string> = {};
  for (const passage of passages) {
    for (const q of passage.questions) {
      typeMap[q.id] = q.type;
    }
  }
  return typeMap;
}

// ============================================
// WEAKNESS ANALYSIS
// ============================================

export interface WeaknessAnalysis {
  problematicQuestions: AnswerEvaluation[];
  patterns: {
    byType: Array<{ type: string; accuracy: number; count: number }>;
    byMethod: Array<{ method: string; count: number }>;
    commonMistakes: Array<{ userAnswer: string; correctAnswer: string; count: number }>;
  };
  recommendations: string[];
}

/**
 * Analyze evaluation results to identify weaknesses and patterns
 */
export function analyzeWeaknesses(
  evaluations: AnswerEvaluation[],
  questionTypes: Record<number, string> = {}
): WeaknessAnalysis {
  const incorrect = evaluations.filter(e => !e.isCorrect);

  // Group by match method (why they got it wrong)
  const byMethod: Record<string, number> = {};
  incorrect.forEach(e => {
    byMethod[e.matchMethod] = (byMethod[e.matchMethod] || 0) + 1;
  });

  // Group by question type
  const byType: Record<string, { correct: number; total: number }> = {};
  evaluations.forEach(e => {
    const type = questionTypes[e.questionId] || 'unknown';
    if (!byType[type]) {
      byType[type] = { correct: 0, total: 0 };
    }
    byType[type].total++;
    if (e.isCorrect) byType[type].correct++;
  });

  // Find common mistakes (same wrong answer across multiple questions)
  const mistakeGroups: Record<string, { correctAnswer: string; count: number }> = {};
  incorrect.forEach(e => {
    const key = e.userAnswer.toLowerCase().trim();
    if (!mistakeGroups[key]) {
      mistakeGroups[key] = { correctAnswer: e.correctAnswer, count: 0 };
    }
    mistakeGroups[key].count++;
  });

  const commonMistakes = Object.entries(mistakeGroups)
    .filter(([, data]) => data.count >= 2) // At least 2 times
    .map(([userAnswer, data]) => ({
      userAnswer,
      correctAnswer: data.correctAnswer,
      count: data.count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10

  // Generate recommendations
  const recommendations: string[] = [];

  // Based on question types
  const weakTypes = Object.entries(byType)
    .map(([type, data]) => ({ type, accuracy: data.correct / data.total }))
    .filter(t => t.accuracy < 0.7)
    .sort((a, b) => a.accuracy - b.accuracy);

  if (weakTypes.length > 0) {
    recommendations.push(`Practice more ${weakTypes.map(t => t.type).join(', ')} questions.`);
  }

  // Based on common mistakes
  if (commonMistakes.length > 0) {
    const topMistake = commonMistakes[0];
    recommendations.push(`Review vocabulary: many mistakes with "${topMistake.userAnswer}" (correct: "${topMistake.correctAnswer}")`);
  }

  // Based on fuzzy matches (spelling issues)
  const fuzzyErrors = incorrect.filter(e => e.matchMethod === 'fuzzy');
  if (fuzzyErrors.length > incorrect.length * 0.3) {
    recommendations.push('Work on spelling accuracy - many near-misses due to spelling errors.');
  }

  // Based on time (if available)
  const slowQuestions = evaluations.filter(e => e.timeSpent && e.timeSpent > 60); // > 60 seconds
  if (slowQuestions.length > evaluations.length * 0.3) {
    recommendations.push('Improve reading speed - spending too long on individual questions.');
  }

  return {
    problematicQuestions: incorrect,
    patterns: {
      byType: Object.entries(byType).map(([type, data]) => ({
        type,
        accuracy: data.correct / data.total,
        count: data.total
      })).sort((a, b) => a.accuracy - b.accuracy),
      byMethod: Object.entries(byMethod).map(([method, count]) => ({ method, count }))
        .sort((a, b) => b.count - a.count),
      commonMistakes,
    },
    recommendations,
  };
}
