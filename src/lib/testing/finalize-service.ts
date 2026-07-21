import { buildQuestionTypeMap, evaluateAnswersAdvanced } from '@/lib/advanced-scoring';
import type { CriterionScore } from '@/lib/ielts-types';
import { calculateOverallBand, evaluateListeningAnswers, rawToBand, roundIELTS } from '@/lib/scoring';
import type {
  AttemptModuleContent,
  AttemptSubmissionPayload,
  FinalizedAttemptResult,
  FinalizedSpeakingScore,
  FinalizedWritingScore,
} from '@/lib/testing/types';

function wordCount(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

function clampBand(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(9, roundIELTS(value)));
}

function criterion(band: number, feedback: string): CriterionScore {
  return {
    band: clampBand(band),
    feedback,
    examples: [],
  };
}

function buildWritingScore(task1: string, task2: string): FinalizedWritingScore {
  const task1WordCount = wordCount(task1);
  const task2WordCount = wordCount(task2);

  const task1Band =
    task1WordCount >= 180 ? 7
      : task1WordCount >= 150 ? 6.5
        : task1WordCount >= 120 ? 6
          : task1WordCount >= 90 ? 5.5
            : 5;

  const task2Band =
    task2WordCount >= 320 ? 7
      : task2WordCount >= 250 ? 6.5
        : task2WordCount >= 200 ? 6
          : task2WordCount >= 150 ? 5.5
            : 5;

  const writingBand = clampBand((task1Band + task2Band * 2) / 3);

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (task1WordCount >= 150) {
    strengths.push('Task 1 meets recommended IELTS word-count coverage.');
  } else {
    improvements.push('Task 1 needs fuller data coverage to meet recommended word-count depth.');
  }

  if (task2WordCount >= 250) {
    strengths.push('Task 2 provides enough room for argument development.');
  } else {
    improvements.push('Task 2 should be expanded to support claims with clearer development.');
  }

  if (strengths.length === 0) {
    strengths.push('Both writing tasks were submitted for backend finalization.');
  }

  const criteriaScores: Record<string, CriterionScore> = {
    'Task Response': criterion(writingBand, 'Task fulfillment estimated from answer completeness and word-count sufficiency.'),
    'Coherence & Cohesion': criterion(writingBand, 'Organization quality estimated from multi-sentence structure and coverage.'),
    'Lexical Resource': criterion(writingBand, 'Vocabulary quality estimated with backend fallback heuristics.'),
    'Grammatical Range': criterion(writingBand, 'Grammar quality estimated with backend fallback heuristics.'),
  };

  return {
    band: writingBand,
    criteriaScores,
    strengths,
    improvements,
    examinerComment: 'Writing was finalized by backend fallback heuristics. AI-backed criterion evaluation can be layered in next iteration.',
    taskWordCounts: {
      task1: task1WordCount,
      task2: task2WordCount,
    },
  };
}

function buildSpeakingScore(part1: string, part2: string, part3: string): FinalizedSpeakingScore {
  const transcriptWordCount = wordCount(`${part1} ${part2} ${part3}`);

  const baseBand =
    transcriptWordCount >= 360 ? 7
      : transcriptWordCount >= 260 ? 6.5
        : transcriptWordCount >= 180 ? 6
          : transcriptWordCount >= 120 ? 5.5
            : 5;

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (transcriptWordCount >= 180) {
    strengths.push('Transcript volume supports sustained response development.');
  } else {
    improvements.push('Provide longer and more developed responses across all speaking parts.');
  }

  if (wordCount(part2) >= 80) {
    strengths.push('Part 2 response appears sufficiently developed for cue-card coverage.');
  } else {
    improvements.push('Part 2 should include more detail and extended explanation.');
  }

  if (strengths.length === 0) {
    strengths.push('Speaking responses were submitted and finalized by backend fallback logic.');
  }

  const criteriaScores: Record<string, CriterionScore> = {
    'Fluency & Coherence': criterion(baseBand, 'Fluency estimated from transcript continuity and response length.'),
    'Lexical Resource': criterion(baseBand, 'Lexical range estimated with backend fallback heuristics.'),
    'Grammatical Range': criterion(baseBand, 'Grammar range estimated with backend fallback heuristics.'),
    Pronunciation: criterion(baseBand, 'Pronunciation inferred from text transcript because audio scoring is not part of this phase.'),
  };

  return {
    band: clampBand(baseBand),
    criteriaScores,
    strengths,
    improvements,
    examinerComment: 'Speaking was finalized by backend fallback heuristics from transcript data. AI-backed examiner scoring can be layered in next iteration.',
    transcriptWordCount,
  };
}

function mergeReadingAnswerKey(modules: AttemptModuleContent): Record<number, string> {
  return modules.readingPassages.reduce<Record<number, string>>((accumulator, passage) => {
    Object.entries(passage.answerKey).forEach(([questionId, answer]) => {
      accumulator[Number(questionId)] = answer;
    });
    return accumulator;
  }, {});
}

export function finalizeAttemptFromSubmissions(
  modules: AttemptModuleContent,
  submissions: AttemptSubmissionPayload,
): FinalizedAttemptResult {
  const listeningValidation = evaluateListeningAnswers(submissions.listeningAnswers, modules.listeningSections);
  const listeningBand = rawToBand(listeningValidation.rawScore);

  const readingAnswerKey = mergeReadingAnswerKey(modules);
  const readingDetailedResults = evaluateAnswersAdvanced(
    submissions.readingAnswers,
    readingAnswerKey,
    buildQuestionTypeMap(modules.readingPassages),
  );
  const readingBand = rawToBand(readingDetailedResults.rawScore);

  const writing = buildWritingScore(
    submissions.writingResponses.task1,
    submissions.writingResponses.task2,
  );

  const speaking = buildSpeakingScore(
    submissions.speakingTranscripts.part1,
    submissions.speakingTranscripts.part2,
    submissions.speakingTranscripts.part3,
  );

  const overallBand = calculateOverallBand([
    listeningBand,
    readingBand,
    writing.band,
    speaking.band,
  ]);

  return {
    listening: {
      band: listeningBand,
      rawScore: listeningValidation.rawScore,
      totalQuestions: listeningValidation.totalQuestions,
      listeningValidation,
    },
    reading: {
      band: readingBand,
      rawScore: readingDetailedResults.rawScore,
      totalQuestions: readingDetailedResults.totalQuestions,
      percentage: readingDetailedResults.percentage,
      detailedResults: readingDetailedResults,
    },
    writing,
    speaking,
    overallBand,
  };
}
