import { useState, useCallback, useRef, useEffect } from 'react';
import { ListeningCBTPhase, ListeningCBTState, SplitScript, ListeningSection } from '@/lib/ielts-types';

// CBT timing constants (in seconds)
const PREP_TIME = 30;
const CHECK_TIME = 30;
const FINAL_REVIEW_TIME = 120;  // 2 minutes

interface UseListeningCBTProps {
  sections: ListeningSection[];
  onComplete: () => void;
}

interface UseListeningCBTReturn {
  state: ListeningCBTState;
  currentScript: SplitScript | null;
  startTest: () => void;
  skipToNextPhase: () => void;
  goToSection: (sectionIndex: number) => void;
  getPhaseLabel: () => string;
  isNavigationLocked: () => boolean;
}

// Split script into two parts at sentence boundaries
function splitScript(script: string, sectionIndex: number): SplitScript {
  const sentences = script.match(/[^.!?]+[.!?]+/g) || [script];

  // Section 4 splits at ~60%, others at ~50%
  const splitRatio = sectionIndex === 3 ? 0.6 : 0.5;
  const splitPoint = Math.floor(sentences.length * splitRatio);

  const part1 = sentences.slice(0, splitPoint).join(' ').trim();
  const part2 = sentences.slice(splitPoint).join(' ').trim();

  // Calculate question ranges (each section has 10 questions, split 5-5)
  const baseQ = sectionIndex * 10 + 1;
  const midAnnouncement = `Now look at questions ${baseQ + 5} to ${baseQ + 9}.`;

  return { part1, part2, midAnnouncement };
}

export function useListeningCBT({ sections, onComplete }: UseListeningCBTProps): UseListeningCBTReturn {
  const [state, setState] = useState<ListeningCBTState>({
    phase: 'prep-time',
    currentSection: 0,
    phaseTimeRemaining: PREP_TIME,
    isAudioLocked: false,
    canNavigate: false,
    currentPart: 1,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isStartedRef = useRef(false);
  const currentPhaseRef = useRef<string>('');
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Get split script for current section
  const currentScript = sections[state.currentSection]
    ? splitScript(sections[state.currentSection].script, state.currentSection)
    : null;

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.speechSynthesis.cancel();
    };
  }, []);

  // Play audio using Web Speech API
  const playAudio = useCallback((text: string, onEnd: () => void) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.lang = 'en-GB';
    utteranceRef.current = utterance;

    utterance.onend = () => {
      utteranceRef.current = null;
      onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  // Get next phase based on current state
  const getNextPhase = useCallback((currentState: ListeningCBTState): Partial<ListeningCBTState> => {
    const { phase, currentSection } = currentState;

    switch (phase) {
      case 'prep-time':
        return {
          phase: 'listening-part1' as ListeningCBTPhase,
          isAudioLocked: true,
          canNavigate: false,
          currentPart: 1,
        };

      case 'listening-part1':
        return {
          phase: 'mid-pause' as ListeningCBTPhase,
        };

      case 'mid-pause':
        return {
          phase: 'listening-part2' as ListeningCBTPhase,
          currentPart: 2,
        };

      case 'listening-part2':
        return {
          phase: 'check-time' as ListeningCBTPhase,
          isAudioLocked: false,
          canNavigate: false,
          phaseTimeRemaining: CHECK_TIME,
        };

      case 'check-time':
        if (currentSection >= 3) {
          return {
            phase: 'final-review' as ListeningCBTPhase,
            canNavigate: true,
            phaseTimeRemaining: FINAL_REVIEW_TIME,
          };
        }
        return {
          phase: 'prep-time' as ListeningCBTPhase,
          currentSection: currentSection + 1,
          phaseTimeRemaining: PREP_TIME,
          currentPart: 1,
        };

      case 'final-review':
        return {
          phase: 'complete' as ListeningCBTPhase,
        };

      default:
        return {};
    }
  }, []);

  // Transition to next phase
  const transitionToNextPhase = useCallback(() => {
    setState(prev => {
      const nextState = getNextPhase(prev);
      return { ...prev, ...nextState };
    });
  }, [getNextPhase]);

  // Run phase logic when phase changes
  useEffect(() => {
    if (!isStartedRef.current) return;

    const phaseKey = `${state.phase}-${state.currentSection}`;
    if (currentPhaseRef.current === phaseKey) return;
    currentPhaseRef.current = phaseKey;

    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const { phase } = state;

    switch (phase) {
      case 'prep-time': {
        setState(prev => ({ ...prev, phaseTimeRemaining: PREP_TIME }));
        timerRef.current = setInterval(() => {
          setState(prev => {
            const newTime = prev.phaseTimeRemaining - 1;
            if (newTime <= 0) {
              if (timerRef.current) clearInterval(timerRef.current);
              timerRef.current = null;
              setTimeout(transitionToNextPhase, 0);
              return { ...prev, phaseTimeRemaining: 0 };
            }
            return { ...prev, phaseTimeRemaining: newTime };
          });
        }, 1000);
        break;
      }

      case 'listening-part1': {
        const script = sections[state.currentSection];
        if (script) {
          const split = splitScript(script.script, state.currentSection);
          playAudio(split.part1, transitionToNextPhase);
        }
        break;
      }

      case 'mid-pause': {
        const script = sections[state.currentSection];
        if (script) {
          const split = splitScript(script.script, state.currentSection);
          playAudio(split.midAnnouncement, transitionToNextPhase);
        }
        break;
      }

      case 'listening-part2': {
        const script = sections[state.currentSection];
        if (script) {
          const split = splitScript(script.script, state.currentSection);
          playAudio(split.part2, transitionToNextPhase);
        }
        break;
      }

      case 'check-time': {
        setState(prev => ({ ...prev, phaseTimeRemaining: CHECK_TIME }));
        timerRef.current = setInterval(() => {
          setState(prev => {
            const newTime = prev.phaseTimeRemaining - 1;
            if (newTime <= 0) {
              if (timerRef.current) clearInterval(timerRef.current);
              timerRef.current = null;
              setTimeout(transitionToNextPhase, 0);
              return { ...prev, phaseTimeRemaining: 0 };
            }
            return { ...prev, phaseTimeRemaining: newTime };
          });
        }, 1000);
        break;
      }

      case 'final-review': {
        setState(prev => ({ ...prev, phaseTimeRemaining: FINAL_REVIEW_TIME }));
        timerRef.current = setInterval(() => {
          setState(prev => {
            const newTime = prev.phaseTimeRemaining - 1;
            if (newTime <= 0) {
              if (timerRef.current) clearInterval(timerRef.current);
              timerRef.current = null;
              setTimeout(transitionToNextPhase, 0);
              return { ...prev, phaseTimeRemaining: 0 };
            }
            return { ...prev, phaseTimeRemaining: newTime };
          });
        }, 1000);
        break;
      }

      case 'complete': {
        if (timerRef.current) clearInterval(timerRef.current);
        window.speechSynthesis.cancel();
        onCompleteRef.current();
        break;
      }
    }
  }, [state.phase, state.currentSection, sections, playAudio, transitionToNextPhase]);

  // Start the test
  const startTest = useCallback(() => {
    if (isStartedRef.current) return;
    isStartedRef.current = true;
    currentPhaseRef.current = '';

    setState({
      phase: 'prep-time',
      currentSection: 0,
      phaseTimeRemaining: PREP_TIME,
      isAudioLocked: false,
      canNavigate: false,
      currentPart: 1,
    });
  }, []);

  // Skip to next phase (only during check-time or prep-time)
  const skipToNextPhase = useCallback(() => {
    if (state.phase === 'check-time' || state.phase === 'prep-time') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      currentPhaseRef.current = '';  // Reset to allow next phase to run
      transitionToNextPhase();
    }
  }, [state.phase, transitionToNextPhase]);

  // Navigate to a specific section (only during final-review)
  const goToSection = useCallback((sectionIndex: number) => {
    if (state.phase === 'final-review' && sectionIndex >= 0 && sectionIndex <= 3) {
      setState(prev => ({ ...prev, currentSection: sectionIndex }));
    }
  }, [state.phase]);

  // Get human-readable phase label
  const getPhaseLabel = useCallback(() => {
    const sectionNum = state.currentSection + 1;
    const partLabel = state.currentPart === 1 ? 'Questions 1-5' : 'Questions 6-10';

    switch (state.phase) {
      case 'prep-time':
        return `Section ${sectionNum} — Read Questions (${state.phaseTimeRemaining}s)`;
      case 'listening-part1':
      case 'listening-part2':
        return `Section ${sectionNum} — Listening (${partLabel})`;
      case 'mid-pause':
        return `Section ${sectionNum} — Moving to next questions...`;
      case 'check-time':
        return `Section ${sectionNum} — Check Answers (${state.phaseTimeRemaining}s)`;
      case 'final-review':
        return `Final Review — All Sections (${Math.floor(state.phaseTimeRemaining / 60)}:${(state.phaseTimeRemaining % 60).toString().padStart(2, '0')})`;
      case 'complete':
        return 'Test Complete';
      default:
        return '';
    }
  }, [state]);

  // Check if navigation is locked
  const isNavigationLocked = useCallback(() => {
    return ['listening-part1', 'mid-pause', 'listening-part2'].includes(state.phase);
  }, [state.phase]);

  return {
    state,
    currentScript,
    startTest,
    skipToNextPhase,
    goToSection,
    getPhaseLabel,
    isNavigationLocked,
  };
}
