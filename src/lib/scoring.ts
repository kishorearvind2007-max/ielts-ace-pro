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

/**
 * Score answers using advanced validation engine (supports fuzzy matching, numeric/date equivalence)
 * Used for AI-generated content with sophisticated answer patterns
 */
export function scoreAnswersWithValidation(
  userAnswers: Record<number, string>,
  questions: Array<{ id: number; type: string }>,
  answerKey: Record<number, string>
): number {
  const { validateAnswer } = require('./listening-validation-engine');
  
  let correct = 0;
  for (const question of questions) {
    const userAnswer = userAnswers[question.id];
    if (!userAnswer || userAnswer.trim().length === 0) {
      continue;
    }

    const result = validateAnswer(userAnswer, question, answerKey);
    if (result.isCorrect) {
      correct++;
    }
  }
  return correct;
}
