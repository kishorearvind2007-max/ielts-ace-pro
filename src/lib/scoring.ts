import type {
  ListeningQuestionValidation,
  ListeningSectionValidationSummary,
  ListeningValidationSummary,
  ListeningSection,
  QuestionType,
} from '@/lib/ielts-types';

export function rawToBand(raw: number): number {
  if (raw >= 39) return 9.0;
  if (raw >= 37) return 8.5;
  if (raw >= 35) return 8.0;
  if (raw >= 33) return 7.5;
  if (raw >= 30) return 7.0;
  if (raw >= 27) return 6.5;
  if (raw >= 23) return 6.0;
  if (raw >= 19) return 5.5;
  if (raw >= 15) return 5.0;
  if (raw >= 13) return 4.5;
  if (raw >= 10) return 4.0;
  if (raw >= 8) return 3.5;
  if (raw >= 6) return 3.0;
  if (raw >= 4) return 2.5;
  return 2.0;
}

export function roundIELTS(x: number): number {
  const decimal = x - Math.floor(x);
  if (decimal < 0.25) return Math.floor(x);
  if (decimal < 0.75) return Math.floor(x) + 0.5;
  return Math.ceil(x);
}

export function calculateOverallBand(bands: number[]): number {
  const avg = bands.reduce((a, b) => a + b, 0) / bands.length;
  return roundIELTS(avg);
}

export function getBandLabel(band: number): string {
  if (band >= 9) return 'Expert User';
  if (band >= 8) return 'Very Good User';
  if (band >= 7) return 'Good User';
  if (band >= 6) return 'Competent User';
  if (band >= 5) return 'Modest User';
  if (band >= 4) return 'Limited User';
  if (band >= 3) return 'Extremely Limited User';
  return 'Non User';
}

export function getCEFR(band: number): string {
  if (band >= 8.5) return 'C2';
  if (band >= 7) return 'C1';
  if (band >= 5.5) return 'B2';
  if (band >= 4) return 'B1';
  if (band >= 2.5) return 'A2';
  return 'A1';
}

export function scoreAnswers(
  userAnswers: Record<number, string>,
  answerKey: Record<number, string>
): number {
  let correct = 0;
  for (const [qId, correctAnswer] of Object.entries(answerKey)) {
    const userAnswer = userAnswers[Number(qId)]?.trim().toLowerCase();
    const expected = correctAnswer.trim().toLowerCase();
    // Support multiple acceptable answers separated by |
    const acceptableAnswers = expected.split('|').map(a => a.trim());
    if (acceptableAnswers.includes(userAnswer || '')) {
      correct++;
    }
  }
  return correct;
}

const MONTH_NORMALIZATION: Record<string, string> = {
  jan: 'january',
  feb: 'february',
  mar: 'march',
  apr: 'april',
  jun: 'june',
  jul: 'july',
  aug: 'august',
  sep: 'september',
  sept: 'september',
  oct: 'october',
  nov: 'november',
  dec: 'december',
};

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

function parseNumberWords(tokens: string[]): number | null {
  if (tokens.length === 0) {
    return null;
  }

  let current = 0;
  let total = 0;

  for (const token of tokens) {
    if (token === 'and') {
      continue;
    }

    if (token === 'hundred') {
      current = current === 0 ? 100 : current * 100;
      continue;
    }

    if (token === 'thousand') {
      total += (current === 0 ? 1 : current) * 1000;
      current = 0;
      continue;
    }

    const value = NUMBER_WORDS[token];
    if (value === undefined) {
      return null;
    }

    current += value;
  }

  return total + current;
}

function normalizeMonthTokens(input: string): string {
  return input.replace(/\b[a-z]{3,5}\b/g, (token) => MONTH_NORMALIZATION[token] ?? token);
}

export function normalizeListeningAnswer(input: string): string {
  if (!input) {
    return '';
  }

  const lowered = input.toLowerCase().trim();
  const normalizedMonths = normalizeMonthTokens(lowered);
  const withoutOrdinals = normalizedMonths.replace(/(\d+)(st|nd|rd|th)\b/g, '$1');
  const stripped = withoutOrdinals
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^[a-z\s-]+$/.test(stripped)) {
    const tokens = stripped.split(/[\s-]+/).filter(Boolean);
    const parsed = parseNumberWords(tokens);
    if (parsed !== null) {
      return String(parsed);
    }
  }

  return stripped;
}

function answerCandidates(raw: string): string[] {
  const normalized = normalizeListeningAnswer(raw);
  if (!normalized) {
    return [];
  }

  const candidates = new Set<string>([normalized, normalized.replace(/\s+/g, '')]);
  const digitsOnly = normalized.replace(/\D+/g, '');
  if (digitsOnly) {
    candidates.add(digitsOnly);
  }

  return Array.from(candidates);
}

function splitAcceptedAnswers(rawAnswer: string): string[] {
  return rawAnswer
    .split('|')
    .map(item => item.trim())
    .filter(Boolean);
}

function deriveListeningSectionNumber(questionId: number): number {
  if (questionId >= 31) {
    return 4;
  }
  if (questionId >= 21) {
    return 3;
  }
  if (questionId >= 11) {
    return 2;
  }
  return 1;
}

type ListeningEvaluationSection = Pick<ListeningSection, 'id' | 'title' | 'questions' | 'answerKey'>;

export function evaluateListeningAnswers(
  userAnswers: Record<number, string>,
  sections: ListeningEvaluationSection[],
): ListeningValidationSummary {
  const safeUserAnswers = userAnswers ?? {};
  const sortedSections = [...sections].sort((a, b) => a.id - b.id);

  const questionLookup = new Map<number, { text: string; type: QuestionType; sectionNumber: number }>();
  sortedSections.forEach(section => {
    section.questions.forEach(question => {
      questionLookup.set(question.id, {
        text: question.text,
        type: question.type,
        sectionNumber: question.section ?? section.id,
      });
    });
  });

  const expectedEntries = sortedSections
    .flatMap(section =>
      Object.entries(section.answerKey).map(([rawId, expectedAnswer]) => ({
        questionId: Number(rawId),
        expectedAnswer: String(expectedAnswer ?? ''),
        sectionNumber: section.id,
      })),
    )
    .filter(entry => Number.isFinite(entry.questionId) && entry.expectedAnswer.trim().length > 0)
    .sort((a, b) => a.questionId - b.questionId);

  const questionResults: ListeningQuestionValidation[] = expectedEntries.map(entry => {
    const rawUserAnswer = String(safeUserAnswers[entry.questionId] ?? '');
    const userAnswer = rawUserAnswer.trim();
    const acceptedAnswers = splitAcceptedAnswers(entry.expectedAnswer);
    const userVariants = answerCandidates(userAnswer);
    const answered = userAnswer.length > 0;
    let matchedAnswer: string | undefined;

    const isCorrect = answered && acceptedAnswers.some(expected => {
      const expectedCandidates = answerCandidates(expected);
      const matched = expectedCandidates.some(candidate => userVariants.includes(candidate));
      if (matched && !matchedAnswer) {
        matchedAnswer = expected;
      }
      return matched;
    });

    const questionMeta = questionLookup.get(entry.questionId);
    return {
      questionId: entry.questionId,
      sectionNumber: questionMeta?.sectionNumber ?? entry.sectionNumber ?? deriveListeningSectionNumber(entry.questionId),
      questionText: questionMeta?.text ?? `Question ${entry.questionId}`,
      questionType: questionMeta?.type ?? 'short-answer',
      userAnswer,
      acceptedAnswers,
      matchedAnswer,
      status: !answered ? 'unanswered' : isCorrect ? 'correct' : 'incorrect',
    };
  });

  const totalQuestions = questionResults.length;
  const rawScore = questionResults.filter(result => result.status === 'correct').length;
  const unansweredCount = questionResults.filter(result => result.status === 'unanswered').length;
  const incorrectCount = questionResults.filter(result => result.status === 'incorrect').length;
  const answeredCount = totalQuestions - unansweredCount;

  const sectionBreakdown: ListeningSectionValidationSummary[] = sortedSections.map(section => {
    const sectionResults = questionResults.filter(result => result.sectionNumber === section.id);
    return {
      sectionNumber: section.id,
      title: section.title,
      correct: sectionResults.filter(result => result.status === 'correct').length,
      total: section.questions.length || sectionResults.length,
    };
  });

  const coveredSections = new Set(sectionBreakdown.map(section => section.sectionNumber));
  const discoveredSections = Array.from(new Set(questionResults.map(result => result.sectionNumber))).sort((a, b) => a - b);
  discoveredSections.forEach(sectionNumber => {
    if (coveredSections.has(sectionNumber)) {
      return;
    }

    const sectionResults = questionResults.filter(result => result.sectionNumber === sectionNumber);
    sectionBreakdown.push({
      sectionNumber,
      correct: sectionResults.filter(result => result.status === 'correct').length,
      total: sectionResults.length,
    });
  });

  sectionBreakdown.sort((a, b) => a.sectionNumber - b.sectionNumber);

  return {
    generatedAt: new Date().toISOString(),
    rawScore,
    totalQuestions,
    answeredCount,
    unansweredCount,
    incorrectCount,
    sectionBreakdown,
    questionResults,
  };
}

export function scoreListeningAnswers(
  userAnswers: Record<number, string>,
  answerKey: Record<number, string>,
): number {
  let correct = 0;

  for (const [qId, expectedAnswer] of Object.entries(answerKey)) {
    const userAnswer = userAnswers[Number(qId)] ?? '';
    const expectedVariants = expectedAnswer.split('|').map(item => item.trim()).filter(Boolean);
    const userVariants = answerCandidates(userAnswer);

    const isCorrect = expectedVariants.some(expected => {
      const expectedCandidates = answerCandidates(expected);
      return expectedCandidates.some(candidate => userVariants.includes(candidate));
    });

    if (isCorrect) {
      correct += 1;
    }
  }

  return correct;
}
