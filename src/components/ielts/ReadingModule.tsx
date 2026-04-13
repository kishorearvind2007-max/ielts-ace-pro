import { useState, useEffect, useRef, useCallback } from 'react';
import { useTest } from './TestProvider';
import { TopBar } from './TopBar';
import { readingContent } from '@/data/ielts-content';
import { rawToBand, scoreAnswers } from '@/lib/scoring';
import { evaluateAnswersAdvanced, buildQuestionTypeMap, type AnswerEvaluation, type EvaluationResult } from '@/lib/advanced-scoring';
import { useAntiCheat } from '@/hooks/use-anti-cheat';
import { Button } from '@/components/ui/button';
import { ChevronRight, Send, Lock, Loader2, BarChart3, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ReadingPassage } from '@/lib/ielts-types';

export function ReadingModule() {
  const { state, dispatch, submitModule } = useTest();
  const [currentPassage, setCurrentPassage] = useState(0);
  const [generatedPassages, setGeneratedPassages] = useState<ReadingPassage[] | null>(null);
  const [isLoadingPassages, setIsLoadingPassages] = useState(true);
  const [passageLoadError, setPassageLoadError] = useState<string | null>(null);

  // Time tracking per question
  const questionStartTimes = useRef<Record<number, number>>({});
  const questionTimes = useRef<Record<number, number>>({});

  useEffect(() => {
    let isMounted = true;

    const loadReadingPassages = async () => {
      try {
        setIsLoadingPassages(true);
        setPassageLoadError(null);
        const response = await fetch('/api/generate-reading-questions', { method: 'POST' });

        if (!response.ok) {
          throw new Error('Unable to generate reading passages');
        }

        const data = await response.json();
        if (isMounted) {
          setGeneratedPassages(Array.isArray(data?.passages) ? data.passages : null);
          if (typeof data?.warning === 'string') {
            setPassageLoadError(data.warning);
          }
        }
      } catch (error) {
        if (isMounted) {
          setPassageLoadError(error instanceof Error ? error.message : 'Failed to load reading passages');
          setGeneratedPassages(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingPassages(false);
        }
      }
    };

    loadReadingPassages();

    return () => {
      isMounted = false;
    };
  }, []);

  const passages = generatedPassages ?? readingContent;
  const passage = passages[currentPassage];
  const allAnswerKeys = passages.reduce<Record<number, string>>((acc, p) => ({ ...acc, ...p.answerKey }), {});
  const answeredCount = Object.keys(state.answers.reading || {}).length;

  // Track when user first sees a question
  const trackQuestionView = useCallback((questionId: number) => {
    if (!questionStartTimes.current[questionId]) {
      questionStartTimes.current[questionId] = Date.now();
    }
  }, []);

  // Update time when user answers
  const trackAnswerTime = useCallback((questionId: number) => {
    const startTime = questionStartTimes.current[questionId];
    if (startTime) {
      questionTimes.current[questionId] = (Date.now() - startTime) / 1000; // seconds
    }
  }, []);

  const handleSubmit = async () => {
    // Calculate final times for all answered questions
    const finalTimes: Record<number, number> = {};
    Object.keys(state.answers.reading || {}).forEach(qId => {
      const numId = Number(qId);
      if (questionStartTimes.current[numId]) {
        finalTimes[numId] = (Date.now() - questionStartTimes.current[numId]) / 1000;
      }
    });

    // Use advanced scoring with analytics
    const advancedResult = evaluateAnswersAdvanced(
      state.answers.reading || {},
      allAnswerKeys,
      buildQuestionTypeMap(passages),
      finalTimes
    );

    // For backward compatibility with existing result display, also calculate simple band
    const raw = scoreAnswers(state.answers.reading || {}, allAnswerKeys);
    const band = rawToBand(raw);

    // Submit with detailed results (will be stored in TestState)
    submitModule({
      module: 'reading',
      band,
      rawScore: advancedResult.rawScore,
      totalQuestions: advancedResult.totalQuestions,
      percentage: advancedResult.percentage,
      answers: state.answers.reading,
      criteriaScores: {
        'Overall Performance': {
          band: advancedResult.band,
          feedback: `You answered ${advancedResult.rawScore} out of ${advancedResult.totalQuestions} correctly (${advancedResult.percentage.toFixed(1)}%)`,
          examples: []
        }
      },
      strengths: [`${advancedResult.rawScore} correct answers`],
      improvements: advancedResult.evaluations
        .filter(e => !e.isCorrect)
        .map(e => `Q${e.questionId}: Expected "${e.correctAnswer}"`),
      examinerComment: `Detailed evaluation: ${advancedResult.evaluations.filter(e => e.isCorrect).length} correct. ${advancedResult.evaluations.filter(e => !e.isCorrect).length} incorrect.`,
      detailedResults: advancedResult // Store full analytics
    });
  };

  const goNextPassage = useCallback(() => {
    if (currentPassage < 2) {
      const next = currentPassage + 1;
      setCurrentPassage(next);
    }
  }, [currentPassage]);

  const { tabSwitchCount } = useAntiCheat({ onAutoSubmit: handleSubmit });

  // Track question view on render
  useEffect(() => {
    passage?.questions.forEach(q => trackQuestionView(q.id));
  }, [passage, trackQuestionView]);

  // Stable answer change handler that accepts questionId
  const handleAnswerChange = useCallback((questionId: number, newAnswer: string) => {
    trackAnswerTime(questionId);
    dispatch({ type: 'SET_ANSWER', module: 'reading', questionId: questionId, answer: newAnswer });
  }, [dispatch, trackAnswerTime]);

  if (isLoadingPassages && !generatedPassages) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopBar title="Reading — Loading" totalSeconds={3600} onTimeUp={handleSubmit} tabSwitchCount={tabSwitchCount} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating IELTS reading passages...
          </div>
        </div>
      </div>
    );
  }

  const renderQuestion = (q: typeof passage.questions[0]) => {
    const answer = state.answers.reading?.[q.id] || '';

    if (q.type === 'mcq') {
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
                onChange={() => handleAnswerChange(q.id, opt)}
                className="sr-only"
              />
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${answer === opt ? 'border-primary' : 'border-muted-foreground'}`}>
                {answer === opt && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <span className="text-sm text-foreground">{opt}</span>
            </label>
          ))}
        </div>
      );
    }

    if (q.type === 'true-false-ng') {
      return (
        <div className="flex gap-2">
          {['True', 'False', 'Not Given'].map(opt => (
            <button
              key={opt}
              onClick={() => handleAnswerChange(q.id, opt)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                answer === opt ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:border-primary/30'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }

    return (
      <input
        type="text"
        value={answer}
        onChange={e => handleAnswerChange(q.id, e.target.value)}
        onPaste={e => e.preventDefault()}
        className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Type your answer..."
      />
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar title={`Reading — Passage ${currentPassage + 1}`} totalQuestions={40} currentQuestion={answeredCount}
        totalSeconds={3600} onTimeUp={handleSubmit} tabSwitchCount={tabSwitchCount} />

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Passage */}
        <div className="lg:w-1/2 border-r border-border overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 60px)' }}>
          {passageLoadError && (
            <div className="mb-4 text-xs text-warning">Using default passages: {passageLoadError}</div>
          )}
          {/* Passage progress - forward only */}
          <div className="flex items-center gap-2 mb-4">
            {[0, 1, 2].map(i => (
              <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                i === currentPassage ? 'bg-primary text-primary-foreground' :
                i < currentPassage ? 'bg-success/20 text-success' : 'bg-secondary text-muted-foreground'
              }`}>
                {i < currentPassage && <Lock className="w-3 h-3" />}
                Passage {i + 1}
              </div>
            ))}
          </div>

          <h3 className="text-xl font-heading font-bold text-foreground mb-4">{passage.title}</h3>
          <div className="text-sm text-secondary-foreground leading-relaxed whitespace-pre-line select-text">
            {passage.text}
          </div>
        </div>

        {/* Questions */}
        <div className="lg:w-1/2 overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 60px)' }}>
          <div className="space-y-6">
            {passage.questions.map(q => (
              <div key={q.id} className="p-4 rounded-xl bg-card border border-border">
                <p className="text-sm font-medium text-foreground mb-3">
                  <span className="text-primary mr-2">Q{q.id}.</span>{q.text}
                </p>
                {renderQuestion(q)}
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-8 pb-8">
            {currentPassage < 2 ? (
              <Button onClick={goNextPassage}>
                Next Passage <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit}>
                <Send className="w-4 h-4 mr-2" /> Submit Reading
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
