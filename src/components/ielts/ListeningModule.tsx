import { useState, useEffect, useCallback } from 'react';
import { useTest } from './TestProvider';
import { TopBar } from './TopBar';
import { listeningContent } from '@/data/ielts-content';
import { rawToBand, scoreAnswers } from '@/lib/scoring';
import { useAntiCheat } from '@/hooks/use-anti-cheat';
import { useListeningCBT } from '@/hooks/use-listening-cbt';
import { Button } from '@/components/ui/button';
import {
  Play,
  SkipForward,
  Volume2,
  Lock,
  Clock,
  Eye,
  Headphones,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export function ListeningModule() {
  const { state, dispatch, submitModule } = useTest();
  const [hasStarted, setHasStarted] = useState(false);

  const allQuestions = listeningContent.flatMap(s => s.questions);
  const answeredCount = Object.keys(state.answers.listening || {}).length;
  const allAnswerKeys = listeningContent.reduce<Record<number, string>>((acc, s) => ({ ...acc, ...s.answerKey }), {});

  const handleSubmit = useCallback(() => {
    window.speechSynthesis.cancel();
    const raw = scoreAnswers(state.answers.listening || {}, allAnswerKeys);
    const band = rawToBand(raw);
    submitModule({ module: 'listening', band, rawScore: raw, totalQuestions: 40, answers: state.answers.listening });
  }, [state.answers.listening, allAnswerKeys, submitModule]);

  const { tabSwitchCount } = useAntiCheat({ onAutoSubmit: handleSubmit });

  const {
    state: cbtState,
    startTest,
    skipToNextPhase,
    goToSection,
    getPhaseLabel,
    isNavigationLocked,
  } = useListeningCBT({
    sections: listeningContent,
    onComplete: handleSubmit,
  });

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const section = listeningContent[cbtState.currentSection];

  // Calculate which questions to highlight based on current part
  const getHighlightedQuestions = () => {
    const baseQ = cbtState.currentSection * 10 + 1;
    if (cbtState.phase === 'listening-part1' || (cbtState.phase === 'prep-time' && cbtState.currentPart === 1)) {
      return { start: baseQ, end: baseQ + 4 };
    }
    if (cbtState.phase === 'listening-part2' || cbtState.phase === 'mid-pause') {
      return { start: baseQ + 5, end: baseQ + 9 };
    }
    return null; // No highlighting during check-time or final-review
  };

  const highlightRange = getHighlightedQuestions();

  const renderQuestion = (q: typeof allQuestions[0]) => {
    const answer = state.answers.listening?.[q.id] || '';
    const isHighlighted = highlightRange && q.id >= highlightRange.start && q.id <= highlightRange.end;
    const isLocked = isNavigationLocked();

    if (q.type === 'mcq' || q.type === 'true-false-ng') {
      return (
        <div className="space-y-2">
          {q.options?.map(opt => (
            <label
              key={opt}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                answer === opt ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'
              } ${isLocked ? 'opacity-75' : ''}`}
            >
              <input
                type="radio"
                name={`q-${q.id}`}
                checked={answer === opt}
                disabled={isLocked}
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
        disabled={isLocked}
        onChange={e => dispatch({ type: 'SET_ANSWER', module: 'listening', questionId: q.id, answer: e.target.value })}
        onPaste={e => e.preventDefault()}
        className={`w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
          isLocked ? 'opacity-75 cursor-not-allowed' : ''
        }`}
        placeholder="Type your answer..."
      />
    );
  };

  // Get phase-specific icon and color
  const getPhaseIndicator = () => {
    switch (cbtState.phase) {
      case 'prep-time':
        return { icon: <Eye className="w-4 h-4" />, color: 'text-blue-500', bg: 'bg-blue-500/10' };
      case 'listening-part1':
      case 'listening-part2':
        return { icon: <Headphones className="w-4 h-4" />, color: 'text-amber-500', bg: 'bg-amber-500/10' };
      case 'mid-pause':
        return { icon: <AlertCircle className="w-4 h-4" />, color: 'text-orange-500', bg: 'bg-orange-500/10' };
      case 'check-time':
        return { icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-500', bg: 'bg-green-500/10' };
      case 'final-review':
        return { icon: <Clock className="w-4 h-4" />, color: 'text-purple-500', bg: 'bg-purple-500/10' };
      default:
        return { icon: <Clock className="w-4 h-4" />, color: 'text-muted-foreground', bg: 'bg-secondary' };
    }
  };

  const phaseIndicator = getPhaseIndicator();

  // Pre-test instructions screen
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopBar
          title="Listening Test — Instructions"
          totalQuestions={40}
          currentQuestion={0}
          totalSeconds={2400}
          onTimeUp={handleSubmit}
          tabSwitchCount={tabSwitchCount}
          isPaused={true}
        />

        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-2xl w-full space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Headphones className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">IELTS Listening Test</h1>
              <p className="text-muted-foreground">Computer-Based Test (CBT) Flow</p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border space-y-4">
              <h2 className="font-semibold text-foreground">How this test works:</h2>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <Eye className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
                  <span><strong className="text-foreground">Prep Time (30s):</strong> Read the questions before each section</span>
                </li>
                <li className="flex items-start gap-3">
                  <Headphones className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" />
                  <span><strong className="text-foreground">Listening:</strong> Audio plays automatically — no pause or replay</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                  <span><strong className="text-foreground">Check Time (30s):</strong> Review and complete your answers</span>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="w-4 h-4 mt-0.5 text-purple-500 flex-shrink-0" />
                  <span><strong className="text-foreground">Final Review (2 min):</strong> Review all 40 answers across all sections</span>
                </li>
              </ul>

              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  <Lock className="w-3 h-3 inline mr-1" />
                  You cannot pause or replay audio during listening phases (authentic IELTS behavior).
                  You can skip ahead during check time if you&apos;re ready.
                </p>
              </div>
            </div>

            <Button
              onClick={() => { setHasStarted(true); startTest(); }}
              size="lg"
              className="w-full"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Listening Test
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar
        title={`Listening — ${section.title}`}
        totalQuestions={40}
        currentQuestion={answeredCount}
        totalSeconds={2400}
        onTimeUp={handleSubmit}
        tabSwitchCount={tabSwitchCount}
      />

      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-6">
        {/* CBT Phase indicator */}
        <div className={`mb-4 p-3 rounded-xl ${phaseIndicator.bg} border border-border flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={phaseIndicator.color}>{phaseIndicator.icon}</div>
            <span className={`text-sm font-medium ${phaseIndicator.color}`}>
              {getPhaseLabel()}
            </span>
          </div>

          {/* Skip button during check/prep time */}
          {(cbtState.phase === 'check-time' || cbtState.phase === 'prep-time') && (
            <Button
              onClick={skipToNextPhase}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              Skip <SkipForward className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>

        {/* Section navigation - clickable only during final-review */}
        <div className="flex items-center gap-2 mb-4">
          {[0, 1, 2, 3].map(i => {
            const isClickable = cbtState.phase === 'final-review';
            const isCurrent = i === cbtState.currentSection;
            const isPast = i < cbtState.currentSection && cbtState.phase !== 'final-review';

            return (
              <button
                key={i}
                onClick={() => isClickable && goToSection(i)}
                disabled={!isClickable}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground'
                    : isPast
                      ? 'bg-success/20 text-success'
                      : 'bg-secondary text-muted-foreground'
                } ${isClickable && !isCurrent ? 'hover:bg-primary/20 cursor-pointer' : ''} ${
                  !isClickable ? 'cursor-default' : ''
                }`}
              >
                {isPast && <Lock className="w-3 h-3" />}
                Section {i + 1}
              </button>
            );
          })}
        </div>

        {/* Audio status indicator */}
        {(cbtState.phase === 'listening-part1' || cbtState.phase === 'listening-part2') && (
          <div className="mb-6 p-4 rounded-xl bg-card border border-amber-500/30">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Volume2 className="w-6 h-6 text-amber-500" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {section.title} — Part {cbtState.currentPart}
                </p>
                <p className="text-xs text-muted-foreground">
                  {cbtState.currentPart === 1 ? 'Questions 1-5' : 'Questions 6-10'} • Audio locked — listen carefully
                </p>
              </div>
              <Lock className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        )}

        {/* Mid-pause announcement */}
        {cbtState.phase === 'mid-pause' && (
          <div className="mb-6 p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 text-center">
            <p className="text-sm font-medium text-orange-500">
              Now look at questions {cbtState.currentSection * 10 + 6} to {cbtState.currentSection * 10 + 10}
            </p>
          </div>
        )}

        {/* Questions - always visible, with highlighting during listening */}
        <div className="space-y-4">
          {section.questions.map(q => {
            const isHighlighted = highlightRange && q.id >= highlightRange.start && q.id <= highlightRange.end;

            return (
              <div
                key={q.id}
                className={`p-4 rounded-xl bg-card border transition-all ${
                  isHighlighted
                    ? 'border-amber-500/50 ring-1 ring-amber-500/30'
                    : 'border-border'
                }`}
              >
                <p className="text-sm font-medium text-foreground mb-3">
                  <span className={`mr-2 ${isHighlighted ? 'text-amber-500' : 'text-primary'}`}>
                    Q{q.id}.
                  </span>
                  {q.text}
                </p>
                {renderQuestion(q)}
              </div>
            );
          })}
        </div>

        {/* Footer with progress */}
        <div className="flex justify-between items-center mt-8 pb-8">
          <div className="text-sm text-muted-foreground">
            {cbtState.phase === 'final-review'
              ? `Reviewing all sections • ${answeredCount}/40 answered`
              : `Section ${cbtState.currentSection + 1} of 4 • ${answeredCount}/40 answered`
            }
          </div>

          {/* Manual submit during final-review */}
          {cbtState.phase === 'final-review' && (
            <Button onClick={handleSubmit}>
              Submit Listening Test
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
