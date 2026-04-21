/** @jest-environment node */

import { listeningContent, readingContent, speakingContent, writingContent } from '@/data/ielts-content';
import { calculateOverallBand } from '@/lib/scoring';
import { finalizeAttemptFromSubmissions } from '@/lib/testing/finalize-service';
import type { AttemptModuleContent, AttemptSubmissionPayload } from '@/lib/testing/types';

describe('finalizeAttemptFromSubmissions', () => {
  const modules: AttemptModuleContent = {
    listeningSections: listeningContent,
    readingPassages: readingContent,
    writingTasks: writingContent,
    speakingParts: speakingContent,
  };

  it('computes backend-owned module and overall bands from submissions', () => {
    const submissions: AttemptSubmissionPayload = {
      listeningAnswers: {
        1: 'Mitchell',
        2: '07845629310',
        3: '850',
      },
      readingAnswers: {
        1: 'False',
        2: 'True',
      },
      writingResponses: {
        task1: 'Short draft about the graph with limited detail.',
        task2: 'This essay is also short and lacks deeper support for arguments.',
      },
      speakingTranscripts: {
        part1: 'I am from Chennai and I enjoy reading books.',
        part2: 'I learned public speaking over two years through consistent practice.',
        part3: 'Technology can help learners with feedback and structure.',
      },
    };

    const result = finalizeAttemptFromSubmissions(modules, submissions);

    expect(result.listening.rawScore).toBeGreaterThanOrEqual(3);
    expect(result.reading.rawScore).toBeGreaterThanOrEqual(2);
    expect(result.writing.band).toBeGreaterThan(0);
    expect(result.speaking.band).toBeGreaterThan(0);

    expect(result.overallBand).toBe(
      calculateOverallBand([
        result.listening.band,
        result.reading.band,
        result.writing.band,
        result.speaking.band,
      ]),
    );
  });

  it('ignores any client-provided score claims and derives all scores from answers/transcripts', () => {
    const submissions = {
      listeningAnswers: {},
      readingAnswers: {},
      writingResponses: {
        task1: 'tiny',
        task2: 'tiny',
      },
      speakingTranscripts: {
        part1: 'tiny',
        part2: 'tiny',
        part3: 'tiny',
      },
      claimedOverallBand: 9,
      claimedReadingBand: 9,
    } as unknown as AttemptSubmissionPayload;

    const result = finalizeAttemptFromSubmissions(modules, submissions);

    expect(result.overallBand).toBeLessThan(9);
    expect(result.reading.rawScore).toBe(0);
    expect(result.listening.rawScore).toBe(0);
  });
});
