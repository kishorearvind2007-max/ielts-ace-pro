import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTest } from './TestProvider';
import { TopBar } from './TopBar';
import { listeningContent } from '@/data/ielts-content';
import { evaluateListeningAnswers, rawToBand } from '@/lib/scoring';
import {
  buildListeningInstructionNarration,
  estimateSpeechDurationMs,
  getListeningQuestionRange,
  READING_LOOK_AHEAD_MS,
} from '@/lib/listening-instructions';
import { useAntiCheat } from '@/hooks/use-anti-cheat';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipForward, Volume2, Lock, Loader2 } from 'lucide-react';
import type { ListeningResultSnapshot, ListeningSection, Question } from '@/lib/ielts-types';

type PlaybackStage = 'idle' | 'intro' | 'look-ahead' | 'listen-now' | 'script';

type PlaybackSegment =
  | { kind: 'speech'; text: string; stage: PlaybackStage }
  | { kind: 'pause'; durationMs: number; stage: 'look-ahead' };

export function ListeningModule() {
  const router = useRouter();
  const { state, dispatch, submitModule } = useTest();
  const [currentSection, setCurrentSection] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [showQuestions, setShowQuestions] = useState(false);
  const [playbackStage, setPlaybackStage] = useState<PlaybackStage>('idle');
  const [sectionComplete, setSectionComplete] = useState<boolean[]>([false, false, false, false]);
  const [generatedSections, setGeneratedSections] = useState<Record<number, ListeningSection>>({});
  const [loadingSection, setLoadingSection] = useState(false);
  const [sectionWarning, setSectionWarning] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sequenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceTokenRef = useRef(0);
  const segmentsRef = useRef<PlaybackSegment[]>([]);
  const currentSegmentIndexRef = useRef(-1);
  const isPlayingRef = useRef(false);
  const playbackStartedAtRef = useRef<number | null>(null);
  const elapsedBeforePauseMsRef = useRef(0);
  const totalDurationMsRef = useRef(1);
  const pendingPauseMsRef = useRef(0);
  const pauseEndsAtRef = useRef<number | null>(null);

  const staticSection = listeningContent[currentSection];
  const section = generatedSections[currentSection] ?? staticSection;
  const questionRange = getListeningQuestionRange(section.questions, currentSection + 1);
  const isSectionReady = !loadingSection || Boolean(generatedSections[currentSection]);
  const allSections = listeningContent.map((fallbackSection, index) => generatedSections[index] ?? fallbackSection);
  const answeredCount = Object.keys(state.answers.listening || {}).length;
  const totalListeningQuestions = allSections.reduce((sum, listeningSection) => sum + listeningSection.questions.length, 0);

  const setPlaying = useCallback((next: boolean) => {
    isPlayingRef.current = next;
    setIsPlaying(next);
  }, []);

  const syncProgress = useCallback(() => {
    const startedAt = playbackStartedAtRef.current;
    const liveElapsed = isPlayingRef.current && startedAt ? Date.now() - startedAt : 0;
    const elapsed = elapsedBeforePauseMsRef.current + liveElapsed;
    const progress = Math.min(100, (elapsed / Math.max(totalDurationMsRef.current, 1)) * 100);
    setAudioProgress(progress);
  }, []);

  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const clearSequencePause = useCallback(() => {
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
      sequenceTimeoutRef.current = null;
    }
    pauseEndsAtRef.current = null;
  }, []);

  const clearPlaybackResources = useCallback(() => {
    window.speechSynthesis.cancel();
    clearProgressInterval();
    clearSequencePause();
    utteranceRef.current = null;
    segmentsRef.current = [];
    currentSegmentIndexRef.current = -1;
  }, [clearProgressInterval, clearSequencePause]);

  const stopPlayback = useCallback((options?: { resetProgress?: boolean }) => {
    sequenceTokenRef.current += 1;
    clearPlaybackResources();
    pendingPauseMsRef.current = 0;
    playbackStartedAtRef.current = null;
    elapsedBeforePauseMsRef.current = 0;
    totalDurationMsRef.current = 1;
    setPlaying(false);
    setPlaybackStage('idle');
    if (options?.resetProgress) {
      setAudioProgress(0);
    }
  }, [clearPlaybackResources, setPlaying]);

  const finalizePlayback = useCallback((token: number) => {
    if (token !== sequenceTokenRef.current) {
      return;
    }
    clearSequencePause();
    clearProgressInterval();
    currentSegmentIndexRef.current = -1;
    playbackStartedAtRef.current = null;
    elapsedBeforePauseMsRef.current = totalDurationMsRef.current;
    pendingPauseMsRef.current = 0;
    setPlaying(false);
    setPlaybackStage('idle');
    setAudioProgress(100);
  }, [clearProgressInterval, clearSequencePause, setPlaying]);

  const playSegment = useCallback((token: number, index: number) => {
    if (token !== sequenceTokenRef.current) {
      return;
    }

    const segment = segmentsRef.current[index];
    if (!segment) {
      finalizePlayback(token);
      return;
    }

    currentSegmentIndexRef.current = index;
    setPlaybackStage(segment.stage);

    if (segment.kind === 'pause') {
      clearSequencePause();
      pendingPauseMsRef.current = segment.durationMs;
      pauseEndsAtRef.current = Date.now() + segment.durationMs;
      sequenceTimeoutRef.current = setTimeout(() => {
        if (token !== sequenceTokenRef.current) {
          return;
        }
        pendingPauseMsRef.current = 0;
        pauseEndsAtRef.current = null;
        playSegment(token, index + 1);
      }, segment.durationMs);
      return;
    }

    const text = segment.text.trim();
    if (!text) {
      playSegment(token, index + 1);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.lang = 'en-GB';
    utteranceRef.current = utterance;
    utterance.onend = () => {
      if (token !== sequenceTokenRef.current) {
        return;
      }
      utteranceRef.current = null;
      playSegment(token, index + 1);
    };
    utterance.onerror = () => {
      if (token !== sequenceTokenRef.current) {
        return;
      }
      utteranceRef.current = null;
      playSegment(token, index + 1);
    };

    window.speechSynthesis.speak(utterance);
  }, [clearSequencePause, finalizePlayback]);

  const startProgressTracking = useCallback((totalDurationMs: number) => {
    totalDurationMsRef.current = Math.max(totalDurationMs, 1);
    elapsedBeforePauseMsRef.current = 0;
    playbackStartedAtRef.current = Date.now();
    clearProgressInterval();
    progressIntervalRef.current = setInterval(syncProgress, 200);
    syncProgress();
  }, [clearProgressInterval, syncProgress]);

  const pausePlayback = useCallback(() => {
    if (!isPlayingRef.current) {
      return;
    }

    if (playbackStartedAtRef.current) {
      elapsedBeforePauseMsRef.current += Date.now() - playbackStartedAtRef.current;
      playbackStartedAtRef.current = null;
    }

    if (playbackStage === 'look-ahead') {
      if (pauseEndsAtRef.current) {
        pendingPauseMsRef.current = Math.max(0, pauseEndsAtRef.current - Date.now());
      }
      clearSequencePause();
    } else {
      window.speechSynthesis.pause();
    }

    syncProgress();
    setPlaying(false);
  }, [clearSequencePause, playbackStage, setPlaying, syncProgress]);

  const resumePlayback = useCallback(() => {
    if (isPlayingRef.current) {
      return;
    }

    playbackStartedAtRef.current = Date.now();
    setPlaying(true);

    if (playbackStage === 'look-ahead' && currentSegmentIndexRef.current >= 0) {
      const token = sequenceTokenRef.current;
      const remainingMs = Math.max(0, pendingPauseMsRef.current);
      if (remainingMs > 0) {
        pauseEndsAtRef.current = Date.now() + remainingMs;
        clearSequencePause();
        sequenceTimeoutRef.current = setTimeout(() => {
          if (token !== sequenceTokenRef.current) {
            return;
          }
          pendingPauseMsRef.current = 0;
          pauseEndsAtRef.current = null;
          playSegment(token, currentSegmentIndexRef.current + 1);
        }, remainingMs);
      } else {
        pendingPauseMsRef.current = 0;
        pauseEndsAtRef.current = null;
        playSegment(token, currentSegmentIndexRef.current + 1);
      }
      return;
    }

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }, [clearSequencePause, playbackStage, playSegment, setPlaying]);

  const persistListeningSnapshot = useCallback((snapshot: ListeningResultSnapshot) => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('listeningResult', JSON.stringify(snapshot));
  }, []);

  const submitListening = useCallback((options?: { skipUnansweredConfirm?: boolean }) => {
    stopPlayback();
    const evaluation = evaluateListeningAnswers(state.answers.listening || {}, allSections);

    if (!options?.skipUnansweredConfirm && evaluation.unansweredCount > 0) {
      const noun = evaluation.unansweredCount === 1 ? 'question' : 'questions';
      const shouldProceed = window.confirm(
        `You still have ${evaluation.unansweredCount} unanswered ${noun}. Submit listening now?`,
      );
      if (!shouldProceed) {
        return;
      }
    }

    const band = rawToBand(evaluation.rawScore);
    const sectionTitles = Object.fromEntries(allSections.map(listeningSection => [listeningSection.id, listeningSection.title]));

    persistListeningSnapshot({
      band,
      rawScore: evaluation.rawScore,
      totalQuestions: evaluation.totalQuestions,
      sectionTitles,
      listeningValidation: evaluation,
      submittedAt: new Date().toISOString(),
    });

    submitModule({
      module: 'listening',
      band,
      rawScore: evaluation.rawScore,
      totalQuestions: evaluation.totalQuestions,
      answers: state.answers.listening,
      listeningValidation: evaluation,
    });

    const sessionId = state.sessionId || localStorage.getItem('currentSessionId') || '';
    router.push(`/result/listening${sessionId ? `?testId=${sessionId}` : ''}`);
  }, [allSections, persistListeningSnapshot, router, state.answers.listening, stopPlayback, submitModule]);

  const handleSubmit = useCallback(() => {
    submitListening();
  }, [submitListening]);

  const handleAutoSubmit = useCallback(() => {
    submitListening({ skipUnansweredConfirm: true });
  }, [submitListening]);

  const { tabSwitchCount } = useAntiCheat({ onAutoSubmit: handleAutoSubmit });

  const playSection = useCallback(() => {
    stopPlayback({ resetProgress: true });

    const narration = buildListeningInstructionNarration(currentSection + 1, questionRange);
    const segments: PlaybackSegment[] = [
      { kind: 'speech', text: narration.intro, stage: 'intro' },
      { kind: 'speech', text: narration.lookAhead, stage: 'look-ahead' },
      { kind: 'pause', durationMs: READING_LOOK_AHEAD_MS, stage: 'look-ahead' },
      { kind: 'speech', text: narration.listenNow, stage: 'listen-now' },
      { kind: 'speech', text: section.script, stage: 'script' },
    ];

    const totalDuration = segments.reduce((total, segment) => {
      if (segment.kind === 'pause') {
        return total + segment.durationMs;
      }
      return total + estimateSpeechDurationMs(segment.text);
    }, 0);

    segmentsRef.current = segments;
    startProgressTracking(totalDuration);
    setPlaying(true);
    setAudioProgress(0);
    setShowQuestions(true);

    const token = sequenceTokenRef.current + 1;
    sequenceTokenRef.current = token;
    playSegment(token, 0);
  }, [currentSection, playSegment, questionRange, section.script, setPlaying, startProgressTracking, stopPlayback]);

  const togglePlayPause = useCallback(() => {
    if (isPlayingRef.current) {
      pausePlayback();
    } else if (playbackStage !== 'idle' && (playbackStage === 'look-ahead' || window.speechSynthesis.paused)) {
      resumePlayback();
    } else {
      playSection();
    }
  }, [pausePlayback, playbackStage, playSection, resumePlayback]);

  // Locked forward-only navigation
  const nextSection = useCallback(() => {
    stopPlayback({ resetProgress: true });
    setShowQuestions(false);
    const newComplete = [...sectionComplete];
    newComplete[currentSection] = true;
    setSectionComplete(newComplete);
    if (currentSection < 3) {
      setCurrentSection(currentSection + 1);
    } else {
      handleSubmit();
    }
  }, [currentSection, sectionComplete, handleSubmit, stopPlayback]);

  useEffect(() => {
    let isMounted = true;

    const loadSection = async () => {
      try {
        setLoadingSection(true);
        setSectionWarning(null);

        const response = await fetch(`/api/generate-listening-questions?sectionNumber=${currentSection + 1}`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Unable to generate listening section');
        }

        const data = await response.json();
        if (!isMounted) {
          return;
        }

        if (data?.section && typeof data.section === 'object') {
          setGeneratedSections(prev => ({
            ...prev,
            [currentSection]: data.section as ListeningSection,
          }));
        }

        if (typeof data?.warning === 'string') {
          setSectionWarning(data.warning);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setSectionWarning(error instanceof Error ? error.message : 'Failed to load listening section');
      } finally {
        if (isMounted) {
          setLoadingSection(false);
        }
      }
    };

    loadSection();

    return () => {
      isMounted = false;
    };
  }, [currentSection]);

  useEffect(() => {
    return () => {
      sequenceTokenRef.current += 1;
      clearPlaybackResources();
    };
  }, [clearPlaybackResources]);

  const renderQuestion = (q: Question) => {
    const answer = state.answers.listening?.[q.id] || '';
    if (q.type === 'mcq' || q.type === 'true-false-ng') {
      return (
        <div className="space-y-2">
          {q.options?.map(opt => (
            <label key={opt} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${answer === opt ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'
              }`}>
              <input type="radio" name={`q-${q.id}`} checked={answer === opt}
                onChange={() => dispatch({ type: 'SET_ANSWER', module: 'listening', questionId: q.id, answer: opt })}
                className="sr-only" />
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${answer === opt ? 'border-primary' : 'border-muted-foreground'}`}>
                {answer === opt && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <span className="text-sm text-foreground">{opt}</span>
            </label>
          ))}
        </div>
      );
    }
    return (
      <input type="text" value={answer}
        onChange={e => dispatch({ type: 'SET_ANSWER', module: 'listening', questionId: q.id, answer: e.target.value })}
        onPaste={e => e.preventDefault()}
        className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Type your answer..." />
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar title={`Listening — ${section.title}`} totalQuestions={totalListeningQuestions} currentQuestion={answeredCount}
        totalSeconds={2400} onTimeUp={handleAutoSubmit} tabSwitchCount={tabSwitchCount} />

      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-6">
        {sectionWarning && (
          <div className="mb-4 text-xs text-warning">Using fallback content: {sectionWarning}</div>
        )}

        {loadingSection && !generatedSections[currentSection] && (
          <div className="mb-6 p-4 rounded-xl bg-card border border-border flex items-center gap-3 text-sm text-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating Test Craft listening section...
          </div>
        )}

        {/* Section progress - no going back */}
        <div className="flex items-center gap-2 mb-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${i === currentSection ? 'bg-primary text-primary-foreground' :
              sectionComplete[i] ? 'bg-success/20 text-success' : 'bg-secondary text-muted-foreground'
              }`}>
              {i < currentSection && <Lock className="w-3 h-3" />}
              Section {i + 1}
            </div>
          ))}
        </div>

        {/* Audio Player */}
        {isSectionReady && (
          <div className="mb-6 p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-4 mb-3">
              <Volume2 className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-foreground">{section.title}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Questions {questionRange.start} to {questionRange.end}</p>
            <div className="flex items-center gap-4">
              <Button onClick={togglePlayPause} size="icon" variant="default">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-gradient-gold rounded-full transition-all" style={{ width: `${audioProgress}%` }} />
              </div>
              <span className="text-xs text-muted-foreground">{Math.round(audioProgress)}%</span>
            </div>
            {!showQuestions && audioProgress === 0 && (
              <p className="text-xs text-muted-foreground mt-2">Press play to hear section instructions before the recording starts.</p>
            )}
            {showQuestions && playbackStage === 'look-ahead' && isPlaying && (
              <p className="text-xs text-muted-foreground mt-2">Read the questions now. The main recording starts shortly.</p>
            )}
            {!isPlaying && playbackStage !== 'idle' && (
              <p className="text-xs text-muted-foreground mt-2">Playback paused. Press play to continue.</p>
            )}
          </div>
        )}

        {isSectionReady && (showQuestions || audioProgress > 0) && (
          <div className="space-y-6">
            {section.questions.map(q => (
              <div key={q.id} className="p-4 rounded-xl bg-card border border-border">
                <p className="text-sm font-medium text-foreground mb-3">
                  <span className="text-primary mr-2">Q{q.id}.</span>{q.text}
                </p>
                {renderQuestion(q)}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between mt-8 pb-8">
          <div className="text-sm text-muted-foreground">Section {currentSection + 1} of 4</div>
          <Button onClick={nextSection} disabled={!isSectionReady}>
            {currentSection < 3 ? (<>Next Section <SkipForward className="w-4 h-4 ml-2" /></>) : 'Submit Listening'}
          </Button>
        </div>
      </div>
    </div>
  );
}
