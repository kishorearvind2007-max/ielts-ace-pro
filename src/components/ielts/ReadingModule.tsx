import { useState, useCallback } from 'react';
import { useTest } from './TestProvider';
import { TopBar } from './TopBar';
import { readingContent } from '@/data/ielts-content';
import { rawToBand, scoreAnswers } from '@/lib/scoring';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Send } from 'lucide-react';

export function ReadingModule() {
  const { state, dispatch, submitModule } = useTest();
  const [currentPassage, setCurrentPassage] = useState(0);

  const passage = readingContent[currentPassage];
  const allAnswerKeys = readingContent.reduce<Record<number, string>>((acc, p) => ({ ...acc, ...p.answerKey }), {});
  const answeredCount = Object.keys(state.answers.reading || {}).length;

  const handleSubmit = useCallback(() => {
    const raw = scoreAnswers(state.answers.reading || {}, allAnswerKeys);
    const band = rawToBand(raw);
    submitModule({
      module: 'reading',
      band,
      rawScore: raw,
      totalQuestions: 40,
      answers: state.answers.reading,
    });
  }, [state.answers.reading, allAnswerKeys, submitModule]);

  const renderQuestion = (q: typeof passage.questions[0]) => {
    const answer = state.answers.reading?.[q.id] || '';

    if (q.type === 'mcq') {
      return (
        <div className="space-y-2">
          {q.options?.map(opt => (
            <label key={opt} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              answer === opt ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30'
            }`}>
              <input type="radio" name={`q-${q.id}`} checked={answer === opt}
                onChange={() => dispatch({ type: 'SET_ANSWER', module: 'reading', questionId: q.id, answer: opt })}
                className="sr-only" />
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

    if (q.type === 'true-false-ng') {
      return (
        <div className="flex gap-2">
          {['True', 'False', 'Not Given'].map(opt => (
            <button key={opt} onClick={() => dispatch({ type: 'SET_ANSWER', module: 'reading', questionId: q.id, answer: opt })}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                answer === opt ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:border-primary/30'
              }`}>
              {opt}
            </button>
          ))}
        </div>
      );
    }

    return (
      <input type="text" value={answer}
        onChange={e => dispatch({ type: 'SET_ANSWER', module: 'reading', questionId: q.id, answer: e.target.value })}
        onPaste={e => e.preventDefault()}
        className="w-full px-4 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Type your answer..." />
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar
        title={`Reading — Passage ${currentPassage + 1}`}
        totalQuestions={40}
        currentQuestion={answeredCount}
        totalSeconds={3600}
        onTimeUp={handleSubmit}
      />

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Passage */}
        <div className="lg:w-1/2 border-r border-border overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 60px)' }}>
          <h3 className="text-xl font-heading font-bold text-foreground mb-4">{passage.title}</h3>
          <div className="text-sm text-secondary-foreground leading-relaxed whitespace-pre-line">
            {passage.text}
          </div>
        </div>

        {/* Questions */}
        <div className="lg:w-1/2 overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 60px)' }}>
          <div className="space-y-6">
            {passage.questions.map(q => (
              <div key={q.id} className="p-4 rounded-xl bg-card border border-border">
                <p className="text-sm font-medium text-foreground mb-3">
                  <span className="text-primary mr-2">Q{q.id}.</span>
                  {q.text}
                </p>
                {renderQuestion(q)}
              </div>
            ))}
          </div>

          <div className="flex justify-between mt-8 pb-8">
            <Button onClick={() => setCurrentPassage(Math.max(0, currentPassage - 1))}
              variant="secondary" disabled={currentPassage === 0}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            {currentPassage < 2 ? (
              <Button onClick={() => setCurrentPassage(currentPassage + 1)}>
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
