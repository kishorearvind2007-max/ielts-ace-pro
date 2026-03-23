/**
 * Demo: Advanced Reading Evaluation Engine
 *
 * This file demonstrates the new advanced scoring capabilities:
 * - Fuzzy matching for spelling tolerance
 * - Pattern-based matching (dates, phone numbers, numeric)
 * - Detailed analytics and weakness analysis
 * - Time-based performance insights
 */

import {
  answersMatch,
  evaluateAnswersAdvanced,
  buildQuestionTypeMap,
  analyzeWeaknesses,
  levenshteinDistance,
  stringSimilarity,
  normalizeDate,
  normalizePhoneNumber,
  normalizeNumber,
} from './src/lib/advanced-scoring';

console.log('=== ADVANCED READING EVALUATION ENGINE DEMO ===\n');

// Example 1: Exact matching
console.log('1. EXACT MATCHING');
console.log(answersMatch('Mitchell', 'Mitchell')); // { match: true, method: 'exact' }
console.log(answersMatch('Mitchell', 'mitchell')); // { match: true, method: 'exact' }
console.log('');

// Example 2: Alternate answers (pipe-separated)
console.log('2. ALTERNATE ANSWERS');
console.log(answersMatch('07845629310', '07845 629 310|07845629310')); // { match: true, method: 'alternate' }
console.log('');

// Example 3: Phone number normalization
console.log('3. PHONE NUMBER NORMALIZATION');
console.log(answersMatch('07845-629-310', '07845 629 310')); // { match: true, method: 'phone-normalized' }
console.log('');

// Example 4: Numeric normalization
console.log('4. NUMERIC NORMALIZATION');
console.log(answersMatch('1,000', '1000')); // { match: true, method: 'numeric-normalized' }
console.log(answersMatch('750', '750')); // exact
console.log('');

// Example 5: Date normalization
console.log('5. DATE NORMALIZATION');
console.log(normalizeDate('1st of September')); // '1 09'
console.log(normalizeDate('September 1')); // '1 09'
console.log(answersMatch('1 September', '1st of September')); // { match: true, method: 'date-normalized' }
console.log('');

// Example 6: Fuzzy matching (spelling tolerance)
console.log('6. FUZZY MATCHING (Levenshtein distance)');
console.log(answersMatch('accommodation', 'accommodation')); // exact
console.log(answersMatch('accomodation', 'accommodation', { fuzzyThreshold: 0.8 })); // { match: true, method: 'fuzzy', score: 0.9 }
console.log(answersMatch('restaurant', 'restaurant')); // exact
console.log(answersMatch('resturant', 'restaurant', { fuzzyThreshold: 0.8 })); // fuzzy
console.log('');

// Levenshtein distance examples
console.log('7. LEVENSHTEIN DISTANCE EXAMPLES');
console.log(`Distance between "kitten" and "sitting": ${levenshteinDistance('kitten', 'sitting')}`); // 3
console.log(`Distance between "book" and "back": ${levenshteinDistance('book', 'back')}`); // 2
console.log(`Similarity: ${stringSimilarity('hello', 'hello')}`); // 1
console.log(`Similarity: ${stringSimilarity('hello', 'hallo')}`); // 0.8
console.log('');

// Example 7: Full evaluation with analytics
console.log('8. FULL ADVANCED EVALUATION');
const userAnswers = {
  1: 'Mitchell',
  2: '07845629310',
  3: '850',
  4: 'one',
  5: 'Park Avenue',
  6: '795',
  7: '120',
  8: '1st September',
  9: '12',
  10: 'Dishwasher',
};

const answerKey = {
  1: 'Mitchell',
  2: '07845 629 310|07845629310',
  3: '850',
  4: '1|one',
  5: 'Park Avenue',
  6: '795',
  7: '120',
  8: '1st of September|first of September|1 September|September 1',
  9: '12',
  10: 'Dishwasher',
};

const questionTypes = {
  1: 'short-answer',
  2: 'short-answer',
  3: 'short-answer',
  4: 'short-answer',
  5: 'short-answer',
  6: 'short-answer',
  7: 'short-answer',
  8: 'short-answer',
  9: 'short-answer',
  10: 'mcq',
};

// Simulate question times (in seconds)
const questionTimes = {
  1: 5,
  2: 8,
  3: 4,
  4: 3,
  5: 6,
  6: 4,
  7: 3,
  8: 10,
  9: 4,
  10: 7,
};

const result = evaluateAnswersAdvanced(userAnswers, answerKey, questionTypes, questionTimes);

console.log(`Raw Score: ${result.rawScore}/${result.totalQuestions}`);
console.log(`Band: ${result.band}`);
console.log(`Percentage: ${result.percentage.toFixed(1)}%`);
console.log(`Average time per question: ${result.timeStats.avgTimePerQuestion.toFixed(1)}s`);
console.log(`Fastest: Q${result.timeStats.fastestQuestion?.id} (${result.timeStats.fastestQuestion?.time}s)`);
console.log(`Slowest: Q${result.timeStats.slowestQuestion?.id} (${result.timeStats.slowestQuestion?.time}s)`);
console.log('');

console.log('Question Types Performance:');
Object.entries(result.questionTypes).forEach(([type, stats]) => {
  const accuracy = ((stats.correct / stats.total) * 100).toFixed(1);
  console.log(`  ${type}: ${stats.correct}/${stats.total} (${accuracy}%)`);
});
console.log('');

console.log('Detailed Evaluations:');
result.evaluations.forEach(e => {
  const status = e.isCorrect ? '✓' : '✗';
  const method = e.matchMethod.padEnd(20);
  const time = e.timeSpent ? ` (${e.timeSpent.toFixed(1)}s)` : '';
  console.log(`  Q${e.questionId}: ${status} ${method} Your: "${e.userAnswer}" Correct: "${e.correctAnswer}"${time}`);
});
console.log('');

// Example 8: Weakness analysis
console.log('9. WEAKNESS ANALYSIS');
const analysis = analyzeWeaknesses(result.evaluations, questionTypes);
console.log('Recommendations:');
analysis.recommendations.forEach((rec, i) => {
  console.log(`  ${i + 1}. ${rec}`);
});
console.log('');

console.log('Common Mistakes:');
analysis.patterns.commonMistakes.forEach(mistake => {
  console.log(`  "${mistake.userAnswer}" → should be "${mistake.correctAnswer}" (${mistake.count} times)`);
});
console.log('');

console.log('=== END DEMO ===');
console.log('\nTo use in your ReadingModule:');
console.log('1. Import: evaluateAnswersAdvanced from "@/lib/advanced-scoring"');
console.log('2. Track question times (optional but recommended)');
console.log('3. Call evaluateAnswersAdvanced with userAnswers, answerKey, questionTypes, and questionTimes');
console.log('4. Submit result with detailedResults included');
console.log('5. ResultsScreen will automatically display the enhanced analytics!');
