/**
 * Test cases for listening-validation-engine
 * Tests the rule-based validation logic for IELTS listening answers
 * Run with: npm test -- listening-validation.test.ts
 */

import { validateAnswer, checkWordLimit } from '@/lib/listening-validation-engine';
import { Question } from '@/lib/ielts-types';

describe('listening-validation-engine', () => {
  describe('validateAnswer - Exact Match (MCQ)', () => {
    const mcqQuestion: Question = {
      id: 1,
      type: 'mcq',
      text: 'What is the answer?',
      options: ['Option A', 'Option B', 'Option C'],
    };

    const answerKey = { 1: 'Option B' };

    test('should accept exact match', () => {
      const result = validateAnswer('Option B', mcqQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
      expect(result.confidence).toBe('high');
    });

    test('should accept case-insensitive match', () => {
      const result = validateAnswer('option b', mcqQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
    });

    test('should reject incorrect option', () => {
      const result = validateAnswer('Option A', mcqQuestion, answerKey);
      expect(result.isCorrect).toBe(false);
    });
  });

  describe('validateAnswer - Fuzzy Matching (Short Answer)', () => {
    const shortAnswerQuestion: Question = {
      id: 2,
      type: 'short-answer',
      text: 'What is the capital of France?',
    };

    test('should accept exact match', () => {
      const answerKey = { 2: 'Paris' };
      const result = validateAnswer('Paris', shortAnswerQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.rule).toBe('exact-match');
    });

    test('should accept minor typos with fuzzy matching', () => {
      const answerKey = { 2: 'Paris' };
      const result = validateAnswer('Pari', shortAnswerQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
      expect(result.confidence).toBe('medium');
    });

    test('should handle alternate answers separated by pipe', () => {
      const answerKey = { 2: 'Paris|Paris, France' };
      const result = validateAnswer('Paris, France', shortAnswerQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
    });
  });

  describe('validateAnswer - Numeric Matching', () => {
    const numericQuestion: Question = {
      id: 3,
      type: 'short-answer',
      text: 'How many students are in the class?',
    };

    test('should match numeric equivalents', () => {
      const answerKey = { 3: '25' };
      const result = validateAnswer('25', numericQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
      expect(result.rule).toBe('exact-match');
    });

    test('should match word numbers to digits', () => {
      const answerKey = { 3: '25|twenty five|twenty-five' };
      const result = validateAnswer('twenty five', numericQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
      expect(result.rule).toBe('numeric-match');
    });

    test('should handle hyphenated numbers', () => {
      const answerKey = { 3: '25' };
      const result = validateAnswer('twenty-five', numericQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
      expect(result.rule).toBe('numeric-match');
    });

    test('should handle currency symbols', () => {
      const answerKey = { 3: '795|795 pounds' };
      const result = validateAnswer('£795', numericQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
      expect(result.rule).toBe('numeric-match');
    });
  });

  describe('validateAnswer - Date Matching', () => {
    const dateQuestion: Question = {
      id: 4,
      type: 'short-answer',
      text: 'When is the event?',
    };

    test('should match DD Month YYYY format', () => {
      const answerKey = { 4: '1st of September|1 September 2024' };
      const result = validateAnswer('1 September 2024', dateQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
      expect(result.rule).toBe('date-match');
    });

    test('should match Month DD YYYY format', () => {
      const answerKey = { 4: 'September 1 2024' };
      const result = validateAnswer('1 September 2024', dateQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
    });

    test('should normalize different date formats', () => {
      const answerKey = { 4: '01/09/2024|1 September 2024' };
      const result = validateAnswer('September 1, 2024', dateQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
    });
  });

  describe('validateAnswer - True/False/Not Given', () => {
    const tfngQuestion: Question = {
      id: 5,
      type: 'true-false-ng',
      text: 'Is the statement true?',
      options: ['True', 'False', 'Not Given'],
    };

    test('should accept True', () => {
      const answerKey = { 5: 'True' };
      const result = validateAnswer('True', tfngQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
    });

    test('should accept False', () => {
      const answerKey = { 5: 'False' };
      const result = validateAnswer('False', tfngQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
    });

    test('should accept Not Given', () => {
      const answerKey = { 5: 'Not Given' };
      const result = validateAnswer('Not Given', tfngQuestion, answerKey);
      expect(result.isCorrect).toBe(true);
    });
  });

  describe('validateAnswer - Multiple Answers (Pipe-separated)', () => {
    const questionWithAlternates: Question = {
      id: 6,
      type: 'short-answer',
      text: 'What is the phone number?',
    };

    test('should accept any piped alternative', () => {
      const answerKey = { 6: '07845 629 310|07845629310|+447845629310' };
      
      const result1 = validateAnswer('07845 629 310', questionWithAlternates, answerKey);
      expect(result1.isCorrect).toBe(true);
      
      const result2 = validateAnswer('07845629310', questionWithAlternates, answerKey);
      expect(result2.isCorrect).toBe(true);
      
      const result3 = validateAnswer('+447845629310', questionWithAlternates, answerKey);
      expect(result3.isCorrect).toBe(true);
    });
  });

  describe('checkWordLimit', () => {
    test('should enforce ONE WORD ONLY', () => {
      const result1 = checkWordLimit('Paris', 'ONE WORD ONLY');
      expect(result1.valid).toBe(true);

      const result2 = checkWordLimit('Paris France', 'ONE WORD ONLY');
      expect(result2.valid).toBe(false);
      expect(result2.reason).toContain('ONE WORD ONLY');
    });

    test('should enforce NO MORE THAN X WORDS', () => {
      const result1 = checkWordLimit('Hello world', 'NO MORE THAN TWO WORDS');
      expect(result1.valid).toBe(true);

      const result2 = checkWordLimit('Hello beautiful world', 'NO MORE THAN TWO WORDS');
      expect(result2.valid).toBe(false);
    });

    test('should accept no limit if not specified', () => {
      const result = checkWordLimit('This is a long answer with many words', undefined);
      expect(result.valid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty answers', () => {
      const question: Question = { id: 7, type: 'short-answer', text: 'Answer?' };
      const answerKey = { 7: 'Answer' };
      const result = validateAnswer('', question, answerKey);
      expect(result.isCorrect).toBe(false);
      expect(result.rule).toBe('empty-answer');
    });

    test('should handle whitespace-only answers', () => {
      const question: Question = { id: 8, type: 'short-answer', text: 'Answer?' };
      const answerKey = { 8: 'Answer' };
      const result = validateAnswer('   ', question, answerKey);
      expect(result.isCorrect).toBe(false);
    });

    test('should handle missing answer key', () => {
      const question: Question = { id: 9, type: 'short-answer', text: 'Answer?' };
      const answerKey = {} as Record<number, string>;
      const result = validateAnswer('test', question, answerKey);
      expect(result.isCorrect).toBe(false);
      expect(result.rule).toBe('no-answer-key');
    });

    test('should be case-insensitive for most matches', () => {
      const question: Question = { id: 10, type: 'short-answer', text: 'Answer?' };
      const answerKey = { 10: 'Mitchell' };
      
      const result1 = validateAnswer('mitchell', question, answerKey);
      expect(result1.isCorrect).toBe(true);
      
      const result2 = validateAnswer('MITCHELL', question, answerKey);
      expect(result2.isCorrect).toBe(true);
    });
  });

  describe('IELTS Listening Realistic Scenarios', () => {
    test('Section 1 - Accommodation inquiry', () => {
      const question: Question = {
        id: 1,
        type: 'short-answer',
        text: "What is the caller's surname?",
      };
      const answerKey = { 1: 'Mitchell' };

      const result = validateAnswer('Mitchell', question, answerKey);
      expect(result.isCorrect).toBe(true);
    });

    test('Section 1 - Phone number with spaces/dashes', () => {
      const question: Question = {
        id: 2,
        type: 'short-answer',
        text: "What is Sarah's phone number?",
      };
      const answerKey = { 2: '07845 629 310|07845629310' };

      const result1 = validateAnswer('07845 629 310', question, answerKey);
      expect(result1.isCorrect).toBe(true);

      const result2 = validateAnswer('07845629310', question, answerKey);
      expect(result2.isCorrect).toBe(true);
    });

    test('Section 2 - Directory labeling', () => {
      const question: Question = {
        id: 11,
        type: 'short-answer',
        text: 'How many floors does the library have?',
      };
      const answerKey = { 11: '3|three' };

      const result = validateAnswer('three', question, answerKey);
      expect(result.isCorrect).toBe(true);
      expect(result.rule).toBe('fuzzy-match');
    });

    test('Section 4 - Lecture numerical facts', () => {
      const question: Question = {
        id: 31,
        type: 'short-answer',
        text: 'How many billion tonnes of CO2?',
      };
      const answerKey = { 31: '525' };

      const result = validateAnswer('525', question, answerKey);
      expect(result.isCorrect).toBe(true);
    });
  });
});
