import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTest } from './TestProvider';
import { TopBar } from './TopBar';
import { speakingContent } from '@/data/ielts-content';
import { roundIELTS } from '@/lib/scoring';
import { useAntiCheat } from '@/hooks/use-anti-cheat';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Send, Loader2, ChevronRight, Clock } from 'lucide-react';
import type {
  CriterionScore,
  SpeakingEvaluationApiResponse,
  SpeakingGenerationApiResponse,
  SpeakingPart,
  SpeakingResultSnapshot,
} from '@/lib/ielts-types';

type TranscriptState = {
  part1: string;
  part2: string;
  part3: string;
};

type EvaluationRequestResult = {
  data: SpeakingEvaluationApiResponse | null;
  error?: string;
};

function isCriterionScore(value: unknown): value is CriterionScore {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const source = value as Partial<CriterionScore>;
  return typeof source.band === 'number'
    && typeof source.feedback === 'string'
    && Array.isArray(source.examples);
}

function isValidEvaluationPayload(value: unknown): value is SpeakingEvaluationApiResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const source = value as Partial<SpeakingEvaluationApiResponse>;
  const pronunciation = source.pronunciation as (CriterionScore & { inferred_from?: string }) | undefined;

  return isCriterionScore(source.fluency_coherence)
    && isCriterionScore(source.lexical_resource)
    && isCriterionScore(source.grammatical_range)
    && isCriterionScore(pronunciation)
    && (typeof pronunciation?.inferred_from === 'undefined' || typeof pronunciation.inferred_from === 'string')
    && typeof source.overall_band === 'number'
    && Array.isArray(source.strengths)
    && Array.isArray(source.improvements)
    && typeof source.examiner_comment === 'string'
    && (source.evaluation_mode === 'ai' || source.evaluation_mode === 'fallback')
    && typeof source.model_used === 'string'
    && typeof source.word_count === 'number';
}

function buildPartKey(partIndex: number): 'part1' | 'part2' | 'part3' {
  return `part${partIndex + 1}` as 'part1' | 'part2' | 'part3';
}

function appendTranscriptEntry(existingText: string, question: string, responseText: string): string {
  const questionLine = `[Q: ${question}]`;
  const entry = `${questionLine}\n${responseText.trim()}`;
  return existingText ? `${existingText}\n\n${entry}` : entry;
}

function buildFullTranscript(transcripts: TranscriptState): string {
  return `Part 1:\n${transcripts.part1}\n\nPart 2:\n${transcripts.part2}\n\nPart 3:\n${transcripts.part3}`;
}

function buildFallbackCriteria(band: number): Record<string, CriterionScore> {
  return {
    'Fluency & Coherence': {
      band,
      feedback: 'Estimated using fallback mode from transcript quality and response length.',
      examples: [],
    },
    'Lexical Resource': {
      band,
      feedback: 'Vocabulary range is estimated in fallback mode.',
      examples: [],
    },
    'Grammatical Range': {
      band,
      feedback: 'Grammar range is estimated in fallback mode.',
      examples: [],
    },
    Pronunciation: {
      band,
      feedback: 'Pronunciation cannot be directly scored from text-only fallback evaluation.',
      examples: [],
    },
  };
}

export function SpeakingModule() {
  const router = useRouter();
  const { state, dispatch } = useTest();
  const [currentPart, setCurrentPart] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [prepTimer, setPrepTimer] = useState(0);
  const [speakTimer, setSpeakTimer] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSpeakingTime, setIsSpeakingTime] = useState(false);
  const [isLoadingParts, setIsLoadingParts] = useState(true);
  const [generatedParts, setGeneratedParts] = useState<SpeakingPart[] | null>(null);
  const [partsWarning, setPartsWarning] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [contentSource, setContentSource] = useState<'nvidia' | 'fallback'>('fallback');

  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const prepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parts = generatedParts ?? speakingContent;
  const part = parts[currentPart] ?? speakingContent[currentPart];

  const getSpeechRecognition = useCallback(() => {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  }, []);

  const persistCurrentTranscript = useCallback((currentTranscript: string): TranscriptState => {
    const cleanedTranscript = currentTranscript.trim();
    if (!cleanedTranscript) {
      return state.speakingTranscripts;
    }

    const partKey = buildPartKey(currentPart);
    const activeQuestion = part.questions[currentQuestion] ?? `Question ${currentQuestion + 1}`;
    const existing = state.speakingTranscripts[partKey];
    const updatedText = appendTranscriptEntry(existing, activeQuestion, cleanedTranscript);

    dispatch({
      type: 'SET_SPEAKING_TRANSCRIPT',
      part: partKey,
      text: updatedText,
    });

    return {
      ...state.speakingTranscripts,
      [partKey]: updatedText,
    };
  }, [currentPart, currentQuestion, dispatch, part.questions, state.speakingTranscripts]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    setSpeechSupported(Boolean(SpeechRecognition));
  }, [getSpeechRecognition]);

  useEffect(() => {
    let isMounted = true;

    const loadSpeakingPrompts = async () => {
      try {
        setIsLoadingParts(true);
        setPartsWarning(null);

        const response = await fetch('/api/generate-speaking-questions', {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Unable to generate speaking prompts');
        }

        const data = await response.json() as SpeakingGenerationApiResponse;
        if (!isMounted) {
          return;
        }

        if (Array.isArray(data.parts) && data.parts.length === 3) {
          setGeneratedParts(data.parts);
          setContentSource(data.source ?? 'fallback');
        } else {
          setGeneratedParts(null);
          setContentSource('fallback');
          setPartsWarning('Generated speaking prompts were invalid. Using default prompts.');
        }

        if (data.source === 'fallback') {
          setPartsWarning(data.warning ?? 'Using default speaking prompts because generation was unavailable.');
        } else if (data.warning) {
          setPartsWarning(data.warning);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setGeneratedParts(null);
        setContentSource('fallback');
        setPartsWarning(error instanceof Error ? error.message : 'Failed to load speaking prompts');
      } finally {
        if (isMounted) {
          setIsLoadingParts(false);
        }
      }
    };

    loadSpeakingPrompts();

    return () => {
      isMounted = false;
    };
  }, []);

  // Speech Recognition setup
  const startRecording = useCallback(() => {
    if (!speechSupported) {
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      // Restart if still recording
      if (isRecordingRef.current) {
        try { recognition.start(); } catch { }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    isRecordingRef.current = true;
    setIsRecording(true);
  }, [getSpeechRecognition, speechSupported]);

  const stopRecording = useCallback((options?: { persist?: boolean }) => {
    recognitionRef.current?.stop();
    isRecordingRef.current = false;
    setIsRecording(false);

    if (!options?.persist) {
      return state.speakingTranscripts;
    }

    return persistCurrentTranscript(transcript);
  }, [persistCurrentTranscript, state.speakingTranscripts, transcript]);

  // Part 2 prep timer
  const startPrepTimer = useCallback((targetPart: SpeakingPart) => {
    if (prepIntervalRef.current) {
      clearInterval(prepIntervalRef.current);
    }
    if (speakIntervalRef.current) {
      clearInterval(speakIntervalRef.current);
    }

    setIsPreparing(true);
    setPrepTimer(targetPart.prepTime || 60);

    prepIntervalRef.current = setInterval(() => {
      setPrepTimer(prev => {
        if (prev <= 1) {
          clearInterval(prepIntervalRef.current!);
          setIsPreparing(false);
          setIsSpeakingTime(true);
          setSpeakTimer(targetPart.speakTime || 120);
          // Start speak timer
          speakIntervalRef.current = setInterval(() => {
            setSpeakTimer(p => {
              if (p <= 1) {
                clearInterval(speakIntervalRef.current!);
                setIsSpeakingTime(false);
                stopRecording({ persist: true });
                setTranscript('');
                return 0;
              }
              return p - 1;
            });
          }, 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopRecording]);

  const nextQuestion = useCallback(() => {
    stopRecording({ persist: true });
    setTranscript('');

    if (currentQuestion < part.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else if (currentPart < parts.length - 1) {
      setCurrentPart(currentPart + 1);
      setCurrentQuestion(0);
      if (currentPart + 1 === 1 && parts[1]?.cueCard) {
        // Part 2: start prep timer
        startPrepTimer(parts[1]);
      }
    }
  }, [currentQuestion, currentPart, part.questions.length, parts, startPrepTimer, stopRecording]);

  const evaluateWithAI = useCallback(async (fullTranscript: string): Promise<EvaluationRequestResult> => {
    try {
      const response = await fetch('/api/evaluate-speaking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullTranscript,
        }),
      });

      if (!response.ok) {
        let detail = '';

        try {
          const errorPayload = await response.clone().json() as {
            error?: unknown;
            warning?: unknown;
            message?: unknown;
          };
          const firstText = [errorPayload.error, errorPayload.warning, errorPayload.message]
            .find(item => typeof item === 'string') as string | undefined;
          detail = firstText?.trim() ?? '';
        } catch {
          detail = (await response.text()).trim();
        }

        const reason = detail ? `API ${response.status}: ${detail}` : `API ${response.status}`;
        return { data: null, error: reason };
      }

      const payload = await response.json() as unknown;
      if (!isValidEvaluationPayload(payload)) {
        return { data: null, error: 'Malformed evaluation payload.' };
      }

      return { data: payload };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Network error during speaking evaluation.',
      };
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isEvaluating) {
      return;
    }

    setIsEvaluating(true);

    const finalTranscripts = stopRecording({ persist: true });
    setTranscript('');

    const transcriptWordCount = Object.values(finalTranscripts)
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .length;
    const fullTranscript = buildFullTranscript(finalTranscripts);

    let band = 5.0;
    let criteriaScores: Record<string, CriterionScore> = {};
    let strengths: string[] = [];
    let improvements: string[] = [];
    let examinerComment = '';
    let evaluationMode: 'ai' | 'fallback' = 'fallback';
    let modelUsed = 'word-count-fallback';
    let warning: string | undefined;

    try {
      const evaluation: EvaluationRequestResult = transcriptWordCount > 0
        ? await evaluateWithAI(fullTranscript)
        : { data: null };
      const result = evaluation.data;

      if (result) {
        band = result.overall_band;
        criteriaScores = {
          'Fluency & Coherence': result.fluency_coherence,
          'Lexical Resource': result.lexical_resource,
          'Grammatical Range': result.grammatical_range,
          Pronunciation: {
            ...result.pronunciation,
            examples: result.pronunciation.examples ?? [],
          },
        };
        strengths = result.strengths || [];
        improvements = result.improvements || [];
        examinerComment = result.examiner_comment || '';
        evaluationMode = result.evaluation_mode;
        modelUsed = result.model_used || modelUsed;
        warning = result.warning;
      } else if (transcriptWordCount === 0) {
        band = 4.0;
        criteriaScores = buildFallbackCriteria(band);
        strengths = ['You completed the speaking flow.'];
        improvements = ['Record at least one spoken response before submitting for AI scoring.'];
        examinerComment = 'No transcript was captured, so AI evaluation was skipped.';
        warning = 'No transcript text was captured; fallback scoring was used.';
      } else {
        band = transcriptWordCount >= 200 ? 6.0 : transcriptWordCount >= 100 ? 5.0 : 4.0;
        criteriaScores = buildFallbackCriteria(band);
        examinerComment = 'AI evaluation unavailable. Fallback scoring was used.';
        warning = evaluation.error ?? 'Speaking evaluator route did not return a valid payload.';
      }

      if (Object.keys(criteriaScores).length === 0) {
        criteriaScores = buildFallbackCriteria(band);
      }

      const roundedBand = roundIELTS(band);

      let snapshot: SpeakingResultSnapshot = {
        band: roundedBand,
        criteriaScores,
        strengths,
        improvements,
        examinerComment,
        transcripts: finalTranscripts,
        evaluationMode,
        modelUsed,
        warning,
        source: contentSource,
        submittedAt: new Date().toISOString(),
      };

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('speakingResult', JSON.stringify(snapshot));
        } catch (error) {
          const storageWarning = error instanceof Error
            ? `Could not save speaking report snapshot: ${error.message}`
            : 'Could not save speaking report snapshot.';
          warning = warning ? `${warning} ${storageWarning}` : storageWarning;
          snapshot = {
            ...snapshot,
            warning,
          };
        }
      }

      dispatch({
        type: 'ADD_RESULT',
        result: {
          module: 'speaking',
          band: roundedBand,
          criteriaScores,
          strengths,
          improvements,
          examinerComment,
        },
      });
      dispatch({ type: 'SET_PHASE', phase: 'home' });
      dispatch({ type: 'SET_MODULE', module: null });
      dispatch({ type: 'SET_TIMER_RUNNING', running: false });

      router.push('/result/speaking');
    } finally {
      setIsEvaluating(false);
    }
  }, [contentSource, dispatch, evaluateWithAI, isEvaluating, router, stopRecording]);

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      recognitionRef.current?.stop();
      if (prepIntervalRef.current) clearInterval(prepIntervalRef.current);
      if (speakIntervalRef.current) clearInterval(speakIntervalRef.current);
    };
  }, []);

  const isLastQuestion = currentPart === parts.length - 1 && currentQuestion === part.questions.length - 1;

  const { tabSwitchCount } = useAntiCheat({ onAutoSubmit: handleSubmit });

  if (isLoadingParts && !generatedParts) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopBar
          title="Speaking — Loading"
          totalSeconds={840}
          onTimeUp={handleSubmit}
          tabSwitchCount={tabSwitchCount}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating speaking prompts...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar
        title={`Speaking — Part ${currentPart + 1}`}
        totalSeconds={840}
        onTimeUp={handleSubmit}
        tabSwitchCount={tabSwitchCount}
      />

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        {partsWarning && (
          <div className="mb-4 text-xs text-warning">Using default speaking prompts: {partsWarning}</div>
        )}

        {!speechSupported && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30">
            <p className="text-sm font-semibold text-destructive mb-1">Speech recognition is unavailable</p>
            <p className="text-sm text-foreground">This speaking test requires browser speech recognition. Please use a supported browser such as Chrome to continue.</p>
          </div>
        )}

        {/* Part indicators */}
        <div className="flex gap-3 mb-8">
          {[1, 2, 3].map(p => (
            <div key={p} className={`px-4 py-2 rounded-lg text-sm font-medium ${currentPart + 1 === p ? 'bg-primary text-primary-foreground' :
                currentPart + 1 > p ? 'bg-success/20 text-success' : 'bg-secondary text-secondary-foreground'
              }`}>
              Part {p}
            </div>
          ))}
        </div>

        {/* Cue Card for Part 2 */}
        {currentPart === 1 && part.cueCard && (
          <div className="mb-6 p-6 rounded-xl bg-card border-2 border-primary/30">
            <h3 className="text-lg font-heading font-bold text-foreground mb-3">{part.cueCard.topic}</h3>
            <p className="text-sm text-muted-foreground mb-3">You should say:</p>
            <ul className="space-y-1 mb-4">
              {part.cueCard.points.map((p, i) => (
                <li key={i} className="text-sm text-foreground flex items-center gap-2">
                  <span className="text-primary">•</span> {p}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground italic">{part.cueCard.followUp}</p>

            {isPreparing && (
              <div className="mt-4 flex items-center gap-2 text-warning text-sm font-medium">
                <Clock className="w-4 h-4" /> Preparation time: {prepTimer}s
              </div>
            )}
            {isSpeakingTime && (
              <div className="mt-4 flex items-center gap-2 text-destructive text-sm font-medium">
                <Mic className="w-4 h-4" /> Speaking time: {speakTimer}s
              </div>
            )}
          </div>
        )}

        {/* Current question */}
        {(!isPreparing || currentPart !== 1) && (
          <div className="mb-8 p-4 rounded-xl bg-card border border-border">
            <p className="text-foreground font-medium">
              <span className="text-primary mr-2">Q{currentQuestion + 1}.</span>
              {part.questions[currentQuestion]}
            </p>
          </div>
        )}

        {/* Mic button */}
        <div className="flex flex-col items-center gap-6 mb-8">
          <button
            onClick={isRecording ? () => stopRecording({ persist: true }) : startRecording}
            disabled={isPreparing || !speechSupported}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${isRecording
                ? 'bg-destructive animate-pulse-recording'
                : (isPreparing || !speechSupported)
                  ? 'bg-secondary cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/80'
              }`}
          >
            {isRecording ? <MicOff className="w-10 h-10 text-foreground" /> : <Mic className="w-10 h-10 text-primary-foreground" />}
          </button>
          <span className="text-sm text-muted-foreground">
            {isRecording
              ? 'Tap to stop recording'
              : isPreparing
                ? 'Preparing...'
                : !speechSupported
                  ? 'Recording unavailable in this browser'
                  : 'Tap to start recording'}
          </span>
        </div>

        {/* Transcript */}
        {transcript && (
          <div className="mb-8 p-4 rounded-xl bg-secondary border border-border">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Live Transcript</h4>
            <p className="text-sm text-foreground leading-relaxed">{transcript}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-end gap-3 pb-8">
          {!isLastQuestion ? (
            <Button onClick={nextQuestion} disabled={!speechSupported}>
              Next Question <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isEvaluating || !speechSupported}>
              {isEvaluating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Evaluating...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Submit Speaking</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
