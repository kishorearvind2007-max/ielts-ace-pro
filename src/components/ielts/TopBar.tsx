import React, { useEffect, useRef, useState } from 'react';
import { useTest } from './TestProvider';
import { Clock, BookOpen, AlertTriangle, ShieldAlert } from 'lucide-react';

interface TopBarProps {
  title: string;
  totalQuestions?: number;
  currentQuestion?: number;
  totalSeconds: number;
  onTimeUp?: () => void;
  tabSwitchCount?: number;
}

export const TopBar = React.memo(function TopBar({ title, totalQuestions, currentQuestion, totalSeconds, onTimeUp, tabSwitchCount = 0 }: TopBarProps) {
  const { dispatch } = useTest();
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    setTimeLeft(totalSeconds);
    hasSubmittedRef.current = false;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next <= 0 && !hasSubmittedRef.current) {
          hasSubmittedRef.current = true;
          clearInterval(interval);
          setTimeout(() => onTimeUpRef.current?.(), 100);
          return 0;
        }
        return Math.max(0, next);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [totalSeconds]);

  useEffect(() => {
    dispatch({ type: 'SET_TIMER', seconds: timeLeft });
  }, [timeLeft, dispatch]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLowTime = timeLeft < 300;
  const isCritical = timeLeft < 60;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-card border-b border-border backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <BookOpen className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold font-heading text-foreground">{title}</h2>
      </div>

      <div className="flex items-center gap-4">
        {tabSwitchCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/15 text-destructive text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" />
            {tabSwitchCount}/3
          </div>
        )}

        {totalQuestions != null && (
          <div className="text-sm text-muted-foreground">
            Question <span className="text-foreground font-medium">{currentQuestion}</span> / {totalQuestions}
          </div>
        )}

        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-mono text-sm font-semibold transition-colors ${
          isCritical ? 'bg-destructive/30 text-destructive animate-pulse' :
          isLowTime ? 'bg-destructive/20 text-destructive' : 'bg-secondary text-secondary-foreground'
        }`}>
          {isCritical && <AlertTriangle className="w-4 h-4" />}
          <Clock className="w-4 h-4" />
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
      </div>
    </div>
  );
});
