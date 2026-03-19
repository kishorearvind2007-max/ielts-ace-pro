import { useState, useCallback, useRef, useEffect } from 'react';
import { useTest } from './TestProvider';
import { TopBar } from './TopBar';
import { speakingContent } from '@/data/ielts-content';
import { roundIELTS } from '@/lib/scoring';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Send, Loader2, ChevronRight, Clock } from 'lucide-react';

export function SpeakingModule() {
  const { state, dispatch, submitModule } = useTest();
  const [currentPart, setCurrentPart] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [prepTimer, setPrepTimer] = useState(0);
  const [speakTimer, setSpeakTimer] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSpeakingTime, setIsSpeakingTime] = useState(false);

  const recognitionRef = useRef<any>(null);
  const prepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const part = speakingContent[currentPart];

  // Speech Recognition setup
  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome.');
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
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      // Restart if still recording
      if (isRecording) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);

    // Save transcript
    const partKey = `part${currentPart + 1}` as 'part1' | 'part2' | 'part3';
    const existing = state.speakingTranscripts[partKey];
    dispatch({
      type: 'SET_SPEAKING_TRANSCRIPT',
      part: partKey,
      text: existing ? `${existing}\n\n[Q: ${part.questions[currentQuestion]}]\n${transcript}` : `[Q: ${part.questions[currentQuestion]}]\n${transcript}`,
    });
  }, [currentPart, currentQuestion, transcript, part, state.speakingTranscripts, dispatch]);

  // Part 2 prep timer
  const startPrepTimer = useCallback(() => {
    setIsPreparing(true);
    setPrepTimer(part.prepTime || 60);

    prepIntervalRef.current = setInterval(() => {
      setPrepTimer(prev => {
        if (prev <= 1) {
          clearInterval(prepIntervalRef.current!);
          setIsPreparing(false);
          setIsSpeakingTime(true);
          setSpeakTimer(part.speakTime || 120);
          // Start speak timer
          speakIntervalRef.current = setInterval(() => {
            setSpeakTimer(p => {
              if (p <= 1) {
                clearInterval(speakIntervalRef.current!);
                setIsSpeakingTime(false);
                stopRecording();
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
  }, [part, stopRecording]);

  const nextQuestion = useCallback(() => {
    stopRecording();
    setTranscript('');

    if (currentQuestion < part.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else if (currentPart < 2) {
      setCurrentPart(currentPart + 1);
      setCurrentQuestion(0);
      if (currentPart + 1 === 1 && speakingContent[1].cueCard) {
        // Part 2: start prep timer
        startPrepTimer();
      }
    }
  }, [currentQuestion, currentPart, part, stopRecording, startPrepTimer]);

  const evaluateWithAI = useCallback(async () => {
    if (!state.apiKey) return null;

    const fullTranscript = `Part 1:\n${state.speakingTranscripts.part1}\n\nPart 2:\n${state.speakingTranscripts.part2}\n\nPart 3:\n${state.speakingTranscripts.part3}`;

    const systemPrompt = `You are a certified IELTS Speaking examiner. Evaluate the transcript according to official IELTS Speaking Band Descriptors.

RETURN STRICTLY THIS JSON:
{
  "fluency_coherence": { "band": 0.0, "feedback": "", "examples": [] },
  "lexical_resource": { "band": 0.0, "feedback": "", "examples": [] },
  "grammatical_range": { "band": 0.0, "feedback": "", "examples": [] },
  "pronunciation": { "band": 0.0, "feedback": "", "inferred_from": "" },
  "overall_band": 0.0,
  "strengths": [],
  "improvements": [],
  "examiner_comment": ""
}`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': state.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: fullTranscript }],
        }),
      });

      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      return JSON.parse(data.content?.[0]?.text || '{}');
    } catch {
      return null;
    }
  }, [state.apiKey, state.speakingTranscripts]);

  const handleSubmit = useCallback(async () => {
    stopRecording();
    setIsEvaluating(true);

    let band = 5.5;
    let criteriaScores: Record<string, { band: number; feedback: string; examples: string[] }> = {};
    let strengths: string[] = [];
    let improvements: string[] = [];
    let examinerComment = '';

    if (state.apiKey) {
      const result = await evaluateWithAI();
      if (result) {
        band = result.overall_band;
        criteriaScores = {
          'Fluency & Coherence': result.fluency_coherence,
          'Lexical Resource': result.lexical_resource,
          'Grammatical Range': result.grammatical_range,
          'Pronunciation': result.pronunciation,
        };
        strengths = result.strengths || [];
        improvements = result.improvements || [];
        examinerComment = result.examiner_comment || '';
      }
    } else {
      // Fallback
      const totalWords = Object.values(state.speakingTranscripts).join(' ').split(/\s+/).length;
      band = totalWords >= 200 ? 6.0 : totalWords >= 100 ? 5.0 : 4.0;
      examinerComment = 'AI evaluation unavailable. Add an API key for detailed feedback.';
    }

    submitModule({
      module: 'speaking',
      band: roundIELTS(band),
      criteriaScores,
      strengths,
      improvements,
      examinerComment,
    });
    setIsEvaluating(false);
  }, [state.apiKey, state.speakingTranscripts, evaluateWithAI, stopRecording, submitModule]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (prepIntervalRef.current) clearInterval(prepIntervalRef.current);
      if (speakIntervalRef.current) clearInterval(speakIntervalRef.current);
    };
  }, []);

  const isLastQuestion = currentPart === 2 && currentQuestion === part.questions.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar
        title={`Speaking — Part ${currentPart + 1}`}
        totalSeconds={840}
        onTimeUp={handleSubmit}
      />

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        {/* Part indicators */}
        <div className="flex gap-3 mb-8">
          {[1, 2, 3].map(p => (
            <div key={p} className={`px-4 py-2 rounded-lg text-sm font-medium ${
              currentPart + 1 === p ? 'bg-primary text-primary-foreground' : 
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
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isPreparing}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
              isRecording
                ? 'bg-destructive animate-pulse-recording'
                : isPreparing
                ? 'bg-secondary cursor-not-allowed'
                : 'bg-primary hover:bg-primary/80'
            }`}
          >
            {isRecording ? <MicOff className="w-10 h-10 text-foreground" /> : <Mic className="w-10 h-10 text-primary-foreground" />}
          </button>
          <span className="text-sm text-muted-foreground">
            {isRecording ? 'Tap to stop recording' : isPreparing ? 'Preparing...' : 'Tap to start recording'}
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
            <Button onClick={nextQuestion}>
              Next Question <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isEvaluating}>
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
