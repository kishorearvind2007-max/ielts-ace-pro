import type { Question } from '@/lib/ielts-types';

export type ListeningQuestionRange = {
  start: number;
  end: number;
};

export type ListeningInstructionNarration = {
  intro: string;
  lookAhead: string;
  listenNow: string;
};

export const READING_LOOK_AHEAD_MS = 8000;

const SECTION_INTRO_SUBJECT: Record<number, string> = {
  1: 'a conversation in an everyday social context',
  2: 'a monologue giving practical information',
  3: 'a discussion in an academic context',
  4: 'a lecture on an academic topic',
};

function fallbackRangeForSection(sectionNumber: number): ListeningQuestionRange {
  const normalizedSection = Number.isInteger(sectionNumber) && sectionNumber > 0 ? sectionNumber : 1;
  const start = (normalizedSection - 1) * 10 + 1;
  return { start, end: start + 9 };
}

export function getListeningQuestionRange(
  questions: Question[] | undefined,
  sectionNumber: number,
): ListeningQuestionRange {
  const validIds = (questions ?? [])
    .map(question => Number(question.id))
    .filter(id => Number.isFinite(id) && id > 0)
    .sort((a, b) => a - b);

  if (validIds.length === 0) {
    return fallbackRangeForSection(sectionNumber);
  }

  return {
    start: validIds[0],
    end: validIds[validIds.length - 1],
  };
}

export function buildListeningInstructionNarration(
  sectionNumber: number,
  range: ListeningQuestionRange,
): ListeningInstructionNarration {
  const subject = SECTION_INTRO_SUBJECT[sectionNumber] ?? 'a recording related to daily and academic life';
  const questionLine = `questions ${range.start} to ${range.end}`;

  return {
    intro: `You will hear ${subject}.`,
    lookAhead: `First, you have some time to look at ${questionLine}.`,
    listenNow: `Now listen carefully and answer ${questionLine}.`,
  };
}

export function estimateSpeechDurationMs(text: string): number {
  const normalizedLength = text.trim().length;
  return Math.max(1200, normalizedLength * 60);
}
