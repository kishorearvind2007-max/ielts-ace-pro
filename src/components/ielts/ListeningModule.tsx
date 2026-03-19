import { useState, useEffect, useRef, useCallback } from 'react';
import { useTest } from './TestProvider';
import { TopBar } from './TopBar';
import { listeningContent } from '@/data/ielts-content';
import { rawToBand, scoreAnswers } from '@/lib/scoring';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipForward, Volume2 } from 'lucide-react';

export function ListeningModule() {
  const { state, dispatch, submitModule } = useTest();
  const [currentSection, setCurrentSection] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [showQuestions, setShowQuestions] = useState(false);
  const [sectionComplete, setSectionComplete] = useState<boolean[]>([false, false, false, false]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const section = listeningContent[currentSection];
  const allQuestions = listeningContent.flatMap(s => s.questions);
  const answeredCount = Object.keys(state.answers.listening || {}).length;

  const allAnswerKeys = listeningContent.reduce<Record<number, string>>((acc, s) => ({ ...acc, ...s.answerKey }), {});

  const handleSubmit = useCallback(() => {
    window.speechSynthesis.cancel();
    const raw = scoreAnswers(state.answers.listening || {}, allAnswerKeys);
    const band = rawToBand(raw);
    submitModule({
      module: 'listening',
      band,
      rawScore: raw,
      totalQuestions: 40,
      answers: state.answers.listening,
    });
  }, [state.answers.listening, allAnswerKeys, submitModule]);

  const playSection = useCallback(() => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(section.script);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.lang = 'en-GB';
    
    utteranceRef.current = utterance;
    setIsPlaying(true);
    setAudioProgress(0);

    const estimatedDuration = section.script.length * 60; // rough ms estimate
    const startTime = Date.now();

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / estimatedDuration) * 100);
      setAudioProgress(progress);
    }, 200);

    utterance.onend = () => {
      setIsPlaying(false);
      setShowQuestions(true);
      setAudioProgress(100);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };

    window.speechSynthesis.speak(utterance);
  }, [section]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      window.speechSynthesis.pause();
      setIsPlaying(false);
    } else if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPlaying(true);
    } else {
      playSection();
    }
  }, [isPlaying, playSection]);

  const nextSection = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setShowQuestions(false);
    setAudioProgress(0);
    const newComplete = [...sectionComplete];
    newComplete[currentSection] = true;
    setSectionComplete(newComplete);
    
    if (currentSection < 3) {
      setCurrentSection(currentSection + 1);
    } else {
      handleSubmit();
    }
  }, [currentSection, sectionComplete, handleSubmit]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const renderQuestion = (q: typeof allQuestions[0]) => {
    const answer = state.answers.listening?.[q.id] || '';

    if (q.type === 'mcq' || q.type === 'true-false-ng') {
      return (
        <div className="space-y-2">
          {q.options?.map(opt => (
            <label key={opt} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              answer === opt ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'
            }`}>
              <input
                type="radio"
                name={`q-${q.id}`}
                checked={answer === opt}
                onChange={() => dispatch({ type: 'SET_ANSWER', module: 'listening', questionId: q.id, answer: opt })}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                answer === opt ? 'border-primary' : 'border-muted-foreground'
              }`}>
                {answer === opt && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <span className="text-sm text-foreground">{opt}</span>
            </label>
          ))}
        </div>
      );
    }

    return (
      <input
        type="text"
        value={answer}
        onChange={e => dispatch({ type: 'SET_ANSWER', module: 'listening', questionId: q.id, answer: e.target.value })}
        onPaste={e => e.preventDefault()}
        className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Type your answer..."
      />
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar
        title={`Listening — ${section.title}`}
        totalQuestions={40}
        currentQuestion={answeredCount}
        totalSeconds={2400}
        onTimeUp={handleSubmit}
      />

      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-6">
        {/* Audio Player */}
        <div className="mb-6 p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-4 mb-3">
            <Volume2 className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">{section.title}</span>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={togglePlayPause} size="icon" variant="default">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-gold rounded-full transition-all" style={{ width: `${audioProgress}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{Math.round(audioProgress)}%</span>
          </div>
          {!showQuestions && !isPlaying && audioProgress === 0 && (
            <p className="text-xs text-muted-foreground mt-2">Press play to listen to the audio. Questions will appear after the audio finishes.</p>
          )}
        </div>

        {/* Questions */}
        {(showQuestions || audioProgress > 0) && (
          <div className="space-y-6">
            {section.questions.map((q, i) => (
              <div key={q.id} className="p-4 rounded-xl bg-card border border-border">
                <p className="text-sm font-medium text-foreground mb-3">
                  <span className="text-primary mr-2">Q{q.id}.</span>
                  {q.text}
                </p>
                {renderQuestion(q)}
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pb-8">
          <div className="text-sm text-muted-foreground">
            Section {currentSection + 1} of 4
          </div>
          <div className="flex gap-3">
            <Button onClick={nextSection} variant="default">
              {currentSection < 3 ? (
                <>Next Section <SkipForward className="w-4 h-4 ml-2" /></>
              ) : 'Submit Listening'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
