import {
	buildListeningInstructionNarration,
	estimateSpeechDurationMs,
	getListeningQuestionRange,
} from '../lib/listening-instructions';
import type { Question } from '../lib/ielts-types';

describe('listening instruction utilities', () => {
	it('derives question ranges from generated question ids', () => {
		const questions: Question[] = [
			{ id: 30, type: 'short-answer', text: 'Q30' },
			{ id: 21, type: 'short-answer', text: 'Q21' },
			{ id: 24, type: 'mcq', text: 'Q24', options: ['A', 'B', 'C', 'D'] },
		];

		expect(getListeningQuestionRange(questions, 3)).toEqual({ start: 21, end: 30 });
	});

	it('falls back to section-based ranges when question ids are unavailable', () => {
		expect(getListeningQuestionRange([], 2)).toEqual({ start: 11, end: 20 });
		expect(getListeningQuestionRange(undefined, 4)).toEqual({ start: 31, end: 40 });
	});

	it('builds IELTS-style intro lines using the question range', () => {
		const narration = buildListeningInstructionNarration(3, { start: 21, end: 30 });

		expect(narration.intro).toContain('academic context');
		expect(narration.lookAhead).toContain('questions 21 to 30');
		expect(narration.listenNow).toContain('questions 21 to 30');
	});

	it('estimates speech duration with a minimum floor', () => {
		const shortDuration = estimateSpeechDurationMs('short');
		const longDuration = estimateSpeechDurationMs('This is a much longer instruction sentence for timing.');

		expect(shortDuration).toBeGreaterThan(0);
		expect(longDuration).toBeGreaterThan(shortDuration);
	});
});
