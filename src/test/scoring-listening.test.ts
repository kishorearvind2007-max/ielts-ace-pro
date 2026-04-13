import { evaluateListeningAnswers, normalizeListeningAnswer, scoreListeningAnswers } from '@/lib/scoring';
import type { ListeningSection } from '@/lib/ielts-types';

describe('listening scoring normalization', () => {
  it('normalizes ordinals and month abbreviations', () => {
    expect(normalizeListeningAnswer('1st Sept')).toBe('1 september');
    expect(normalizeListeningAnswer('September 1st')).toBe('september 1');
  });

  it('normalizes number words to digits', () => {
    expect(normalizeListeningAnswer('twenty one')).toBe('21');
    expect(normalizeListeningAnswer('one hundred and twenty')).toBe('120');
  });

  it('scores listening answers with tolerant variants', () => {
    const answerKey = {
      1: 'first of September|1 September|September 1',
      2: '07845 629 310|07845629310',
      3: '20|twenty',
      4: 'Park Avenue',
    };

    const answers = {
      1: '1st Sept',
      2: '07845629310',
      3: 'twenty',
      4: 'park avenue',
    };

    expect(scoreListeningAnswers(answers, answerKey)).toBe(4);
  });

  it('returns detailed per-question validation including unanswered answers', () => {
    const sections: ListeningSection[] = [
      {
        id: 1,
        title: 'Section 1',
        script: 'Sample script 1',
        questions: [
          { id: 1, type: 'short-answer', text: "What is the caller's surname?", section: 1 },
          { id: 2, type: 'short-answer', text: 'What is the phone number?', section: 1 },
        ],
        answerKey: {
          1: 'Mitchell',
          2: '07845 629 310|07845629310',
        },
      },
      {
        id: 2,
        title: 'Section 2',
        script: 'Sample script 2',
        questions: [
          { id: 11, type: 'true-false-ng', text: 'Library membership requires a fee.', options: ['True', 'False', 'Not Given'], section: 2 },
        ],
        answerKey: {
          11: 'False',
        },
      },
    ];

    const answers = {
      1: 'mitchell',
      2: '',
      11: 'True',
    };

    const evaluation = evaluateListeningAnswers(answers, sections);

    expect(evaluation.rawScore).toBe(1);
    expect(evaluation.totalQuestions).toBe(3);
    expect(evaluation.answeredCount).toBe(2);
    expect(evaluation.unansweredCount).toBe(1);
    expect(evaluation.incorrectCount).toBe(1);

    expect(evaluation.questionResults).toEqual([
      expect.objectContaining({ questionId: 1, status: 'correct', sectionNumber: 1 }),
      expect.objectContaining({ questionId: 2, status: 'unanswered', sectionNumber: 1 }),
      expect.objectContaining({ questionId: 11, status: 'incorrect', sectionNumber: 2 }),
    ]);

    expect(evaluation.sectionBreakdown).toEqual([
      expect.objectContaining({ sectionNumber: 1, correct: 1, total: 2 }),
      expect.objectContaining({ sectionNumber: 2, correct: 0, total: 1 }),
    ]);
  });

  it('keeps raw-score parity with legacy listening scorer', () => {
    const sections: ListeningSection[] = [
      {
        id: 1,
        title: 'Section 1',
        script: 'Sample script',
        questions: [
          { id: 1, type: 'short-answer', text: 'Q1', section: 1 },
          { id: 2, type: 'short-answer', text: 'Q2', section: 1 },
          { id: 3, type: 'short-answer', text: 'Q3', section: 1 },
        ],
        answerKey: {
          1: 'first of September|1 September|September 1',
          2: '07845 629 310|07845629310',
          3: '20|twenty',
        },
      },
    ];

    const answerKey = {
      1: 'first of September|1 September|September 1',
      2: '07845 629 310|07845629310',
      3: '20|twenty',
    };

    const answers = {
      1: '1st Sept',
      2: '07845629310',
      3: 'twenty',
    };

    const evaluation = evaluateListeningAnswers(answers, sections);
    const legacyScore = scoreListeningAnswers(answers, answerKey);

    expect(evaluation.rawScore).toBe(legacyScore);
    expect(evaluation.rawScore).toBe(3);
  });
});
