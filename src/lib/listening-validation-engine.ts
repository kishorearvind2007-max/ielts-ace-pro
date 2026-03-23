/**
 * Custom Rule-Based Answer Validation Engine for IELTS Listening
 * Handles fuzzy matching, numeric equivalence, date normalization, and IELTS-specific rules
 * NO AI required - purely deterministic rule-based validation
 */

import { Question, QuestionType } from './ielts-types';

export interface ValidationConfig {
  type: 'fuzzy' | 'exact' | 'numeric' | 'date' | 'spelling';
  threshold?: number; // For fuzzy matching (0-1, default 0.8)
  caseSensitive?: boolean;
  allowPartialMatch?: boolean;
}

export interface ValidationResult {
  isCorrect: boolean;
  feedback?: string;
  expectedAnswers: string[];
  confidence: 'high' | 'medium' | 'low';
  rule: string;
}

/**
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\-]/g, ''); // Remove special characters except hyphen
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1) using Levenshtein distance
 */
function getSimilarityScore(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Convert number words to digits
 */
function wordToNumber(word: string): string | null {
  const numberWords: Record<string, string> = {
    zero: '0',
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    nine: '9',
    ten: '10',
    eleven: '11',
    twelve: '12',
    thirteen: '13',
    fourteen: '14',
    fifteen: '15',
    sixteen: '16',
    seventeen: '17',
    eighteen: '18',
    nineteen: '19',
    twenty: '20',
    thirty: '30',
    forty: '40',
    fifty: '50',
    sixty: '60',
    seventy: '70',
    eighty: '80',
    ninety: '90',
    hundred: '100',
    thousand: '1000',
    million: '1000000',
  };

  return numberWords[word] || null;
}

/**
 * Extract and normalize numbers from text
 */
function extractNumbers(text: string): string[] {
  const numbers: string[] = [];
  const words = text.split(/\s+/);

  for (const word of words) {
    const num = wordToNumber(word);
    if (num) {
      numbers.push(num);
    }
  }

  // Also extract digit sequences
  const digitMatches = text.match(/\d+/g);
  if (digitMatches) {
    numbers.push(...digitMatches);
  }

  return [...new Set(numbers)]; // Deduplicate
}

/**
 * Normalize date formats to YYYY-MM-DD
 */
function normalizeDate(dateStr: string): string | null {
  const dateStr_ = dateStr.toLowerCase().trim();

  // Month mappings
  const months: Record<string, string> = {
    january: '01', jan: '01',
    february: '02', feb: '02',
    march: '03', mar: '03',
    april: '04', apr: '04',
    may: '05',
    june: '06', jun: '06',
    july: '07', jul: '07',
    august: '08', aug: '08',
    september: '09', sep: '09', sept: '09',
    october: '10', oct: '10',
    november: '11', nov: '11',
    december: '12', dec: '12',
  };

  // Try common date formats
  const patterns = [
    // DD Month YYYY or D Month YYYY
    { regex: /(\d{1,2})\s+(\w+)\s+(\d{4})/, format: (m: RegExpMatchArray) => {
      const month = months[m[2]] || null;
      return month ? `${m[3]}-${month}-${m[1].padStart(2, '0')}` : null;
    }},
    // Month DD YYYY
    { regex: /(\w+)\s+(\d{1,2})\s+(\d{4})/, format: (m: RegExpMatchArray) => {
      const month = months[m[1]] || null;
      return month ? `${m[3]}-${month}-${m[2].padStart(2, '0')}` : null;
    }},
    // DD/MM/YYYY or YYYY-MM-DD
    { regex: /(\d{1,4})[-/](\d{1,2})[-/](\d{1,4})/, format: (m: RegExpMatchArray) => {
      let y = m[3], m_ = m[2], d = m[1];
      if (m.length > 0 && m[1].length === 4) {
        y = m[1]; m_ = m[2]; d = m[3];
      }
      return `${y.padStart(4, '0')}-${m_.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }},
  ];

  for (const pattern of patterns) {
    const match = dateStr_.match(pattern.regex);
    if (match) {
      return pattern.format(match);
    }
  }

  return null;
}

/**
 * Check if answer is a number-based question
 */function isNumericMatch(userAnswer: string, expectedAnswers: string[]): boolean {
  const userNums = extractNumbers(userAnswer);
  if (userNums.length === 0) return false;

  for (const expected of expectedAnswers) {
    const expectedNums = extractNumbers(expected);
    if (expectedNums.length > 0 && userNums.some(n => expectedNums.includes(n))) {
      return true;
    }
  }

  return false;
}

/**
 * Check if answer is a date-based question
 */
function isDateMatch(userAnswer: string, expectedAnswers: string[]): boolean {
  const userDate = normalizeDate(userAnswer);
  if (!userDate) return false;

  for (const expected of expectedAnswers) {
    const expectedDate = normalizeDate(expected);
    if (expectedDate && userDate === expectedDate) {
      return true;
    }
  }

  return false;
}

/**
 * Check MCQ/True-False-Not Given: exact option match
 */
function validateExactMatch(userAnswer: string, expectedAnswers: string[]): ValidationResult {
  const normalized = normalizeText(userAnswer);

  for (const expected of expectedAnswers) {
    if (normalizeText(expected) === normalized) {
      return {
        isCorrect: true,
        expectedAnswers,
        confidence: 'high',
        rule: 'exact-match',
      };
    }
  }

  return {
    isCorrect: false,
    feedback: `Expected one of: ${expectedAnswers.join(', ')}`,
    expectedAnswers,
    confidence: 'high',
    rule: 'exact-match',
  };
}

/**
 * Fuzzy matching for short answers with tolerance
 */
function validateFuzzyMatch(
  userAnswer: string,
  expectedAnswers: string[],
  threshold: number = 0.8
): ValidationResult {
  const userNorm = normalizeText(userAnswer);

  for (const expected of expectedAnswers) {
    const expectedNorm = normalizeText(expected);
    const similarity = getSimilarityScore(userNorm, expectedNorm);

    if (similarity >= threshold) {
      const confidence = similarity === 1 ? 'high' : similarity > 0.9 ? 'medium' : 'low';
      return {
        isCorrect: true,
        expectedAnswers,
        confidence,
        rule: `fuzzy-match (${(similarity * 100).toFixed(0)}%)`,
      };
    }

    // Check if user answer is substring of expected (or vice versa)
    if (expectedNorm.includes(userNorm) || userNorm.includes(expectedNorm)) {
      return {
        isCorrect: true,
        expectedAnswers,
        confidence: 'medium',
        rule: 'substring-match',
      };
    }
  }

  return {
    isCorrect: false,
    feedback: `Answer did not match: ${expectedAnswers.join(', ')}`,
    expectedAnswers,
    confidence: 'high',
    rule: 'fuzzy-match',
  };
}

/**
 * Main validation orchestrator
 */
export function validateAnswer(
  userAnswer: string,
  questionMetadata: Question,
  answerKey: Record<number, string>,
  config?: ValidationConfig
): ValidationResult {
  const questionId = questionMetadata.id;
  const expectedAnswer = answerKey[questionId];

  if (!expectedAnswer) {
    return {
      isCorrect: false,
      feedback: 'No answer key found for this question',
      expectedAnswers: [],
      confidence: 'low',
      rule: 'no-answer-key',
    };
  }

  // Split pipe-separated answers
  const expectedAnswers = expectedAnswer.split('|').map(a => a.trim());

  // Handle empty answer
  if (!userAnswer || userAnswer.trim().length === 0) {
    return {
      isCorrect: false,
      feedback: 'Answer cannot be empty',
      expectedAnswers,
      confidence: 'high',
      rule: 'empty-answer',
    };
  }

  // Question type-specific validation
  switch (questionMetadata.type) {
    case 'mcq':
    case 'true-false-ng':
      // Exact match required for multiple choice
      return validateExactMatch(userAnswer, expectedAnswers);

    case 'short-answer':
    case 'note-completion':
    case 'sentence-completion':
      // Try multiple strategies

      // 1. Try exact match first
      const exactResult = validateExactMatch(userAnswer, expectedAnswers);
      if (exactResult.isCorrect) return exactResult;

      // 2. Check for numeric/date answers
      if (isNumericMatch(userAnswer, expectedAnswers)) {
        return {
          isCorrect: true,
          expectedAnswers,
          confidence: 'high',
          rule: 'numeric-match',
        };
      }

      if (isDateMatch(userAnswer, expectedAnswers)) {
        return {
          isCorrect: true,
          expectedAnswers,
          confidence: 'high',
          rule: 'date-match',
        };
      }

      // 3. Fuzzy matching with threshold
      const threshold = config?.threshold || 0.8;
      return validateFuzzyMatch(userAnswer, expectedAnswers, threshold);

    case 'form-completion':
    case 'table-completion':
    case 'note-completion':
      // Allow fuzzy matching for completion tasks
      return validateFuzzyMatch(userAnswer, expectedAnswers, 0.75);

    case 'matching':
      // Exact match for matching questions
      return validateExactMatch(userAnswer, expectedAnswers);

    default:
      // Fallback to fuzzy matching
      return validateFuzzyMatch(userAnswer, expectedAnswers, 0.8);
  }
}

/**
 * Batch validate all answers in a section
 */
export function scoreAnswersWithValidation(
  userAnswers: Record<number, string>,
  questions: Question[],
  answerKey: Record<number, string>
): {
  correct: number;
  incorrect: number;
  skipped: number;
  details: Array<ValidationResult & { questionId: number }>;
} {
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  const details: Array<ValidationResult & { questionId: number }> = [];

  for (const question of questions) {
    const userAnswer = userAnswers[question.id];

    if (!userAnswer || userAnswer.trim().length === 0) {
      skipped++;
      details.push({
        questionId: question.id,
        isCorrect: false,
        expectedAnswers: answerKey[question.id] ? answerKey[question.id].split('|') : [],
        confidence: 'high',
        rule: 'skipped',
      });
      continue;
    }

    const result = validateAnswer(userAnswer, question, answerKey);
    details.push({ questionId: question.id, ...result });

    if (result.isCorrect) {
      correct++;
    } else {
      incorrect++;
    }
  }

  return { correct, incorrect, skipped, details };
}

/**
 * Enforce word limit rules
 */
export function checkWordLimit(answer: string, limit?: string): { valid: boolean; reason?: string } {
  if (!limit) return { valid: true };

  const answerWords = answer.trim().split(/\s+/);
  const wordCount = answerWords.length;

  if (limit === 'ONE WORD ONLY') {
    if (wordCount === 1) return { valid: true };
    return { valid: false, reason: `Must be ONE WORD ONLY (got ${wordCount})` };
  }

  const match = limit.match(/NO MORE THAN (\d+) WORDS?/i);
  if (match) {
    const maxWords = parseInt(match[1], 10);
    if (wordCount <= maxWords) return { valid: true };
    return { valid: false, reason: `Maximum ${maxWords} words allowed (got ${wordCount})` };
  }

  const match2 = limit.match(/AT LEAST (\d+) WORDS?/i);
  if (match2) {
    const minWords = parseInt(match2[1], 10);
    if (wordCount >= minWords) return { valid: true };
    return { valid: false, reason: `Minimum ${minWords} words required (got ${wordCount})` };
  }

  return { valid: true };
}
