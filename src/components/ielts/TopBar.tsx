import { useEffect, useRef } from 'react';
import { useTest } from './TestProvider';
import { Clock, BookOpen } from 'lucide-react';

interface TopBarProps {
  title: string;
  totalQuestions?: number;
  currentQuestion?: number;
  totalSeconds: number;
  onTimeUp?: () => void;
}

export function TopBar({ title, totalQuestions, currentQuestion, totalSeconds, onTimeUp }: TopBarProps) {
  const { state, dispatch } = useTest();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    dispatch({ type: 'SET_TIMER', seconds: totalSeconds });
    dispatch({ type: 'SET_TIMER_RUNNING', running: true });

    timerRef.current = setInterval(() => {
      dispatch({ type: 'SET_TIMER', seconds: Math.max(0, state.timerSeconds - 1) });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSeconds]);

  useEffect(() => {
    if (state.timerSeconds <= 0 && state.isTimerRunning) {
      dispatch({ type: 'SET_TIMER_RUNNING', running: false });
      if (timerRef.current) clearInterval(timerRef.current);
      onTimeUpRef.current?.();
    }
  }, [state.timerSeconds, state.isTimerRunning, dispatch]);

  // Update timer each second
  useEffect(() => {
    if (!state.isTimerRunning) return;

    const interval = setInterval(() => {
      dispatch({ type: 'SET_TIMER', seconds: Math.max(0, state.timerSeconds - 1) });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.isTimerRunning, state.timerSeconds, dispatch]);

  const minutes = Math.floor(state.timerSeconds / 60);
  const seconds = state.timerSeconds % 60;
  const isLowTime = state.timerSeconds < 300;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-card border-b border-border backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <BookOpen className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold font-heading text-foreground">{title}</h2>
      </div>

      <div className="flex items-center gap-6">
        {totalQuestions && (
          <div className="text-sm text-muted-foreground">
            Question <span className="text-foreground font-medium">{currentQuestion}</span> / {totalQuestions}
          </div>
        )}
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-mono text-sm font-semibold ${
          isLowTime ? 'bg-destructive/20 text-destructive' : 'bg-secondary text-secondary-foreground'
        }`}>
          <Clock className="w-4 h-4" />
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
      </div>
    </div>
  );
}
