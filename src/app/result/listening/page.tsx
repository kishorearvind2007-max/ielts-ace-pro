"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, CheckCircle2, Home, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ListeningQuestionStatus, ListeningResultSnapshot } from '@/lib/ielts-types';

type ResultFilter = 'all' | 'incorrect' | 'unanswered';

function getStatusLabel(status: ListeningQuestionStatus) {
  if (status === 'correct') {
    return 'Correct';
  }
  if (status === 'incorrect') {
    return 'Incorrect';
  }
  return 'Unanswered';
}

function getStatusStyles(status: ListeningQuestionStatus) {
  if (status === 'correct') {
    return 'bg-success/15 text-success border-success/30';
  }
  if (status === 'incorrect') {
    return 'bg-destructive/15 text-destructive border-destructive/30';
  }
  return 'bg-warning/15 text-warning border-warning/30';
}

export default function ListeningResultPage() {
  const router = useRouter();
  const [data, setData] = useState<ListeningResultSnapshot | null>(null);
  const [filter, setFilter] = useState<ResultFilter>('all');

  useEffect(() => {
    const loadResults = async () => {
      // Try to get sessionId from URL params or localStorage
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('testId') || localStorage.getItem('currentSessionId');

      if (sessionId) {
        // Fetch from database
        try {
          const response = await fetch(`/api/test-attempts/${sessionId}`);
          if (response.ok) {
            const data = await response.json();
            const moduleResult = data.attempt?.moduleResults?.listening;
            if (moduleResult?.listeningValidation?.questionResults) {
              setData(moduleResult as ListeningResultSnapshot);
              return;
            }
          }
        } catch (error) {
          console.warn('[listening-result] Failed to fetch from database:', error);
        }
      }

      // Fallback to localStorage
      const raw = localStorage.getItem('listeningResult');
      if (!raw) {
        router.push('/dashboard');
        return;
      }

      try {
        const parsed = JSON.parse(raw) as ListeningResultSnapshot;
        if (!parsed?.listeningValidation?.questionResults) {
          throw new Error('Invalid listening result payload');
        }
        setData(parsed);
      } catch {
        router.push('/dashboard');
      }
    };

    loadResults();
  }, [router]);

  const filteredQuestionResults = useMemo(() => {
    if (!data) {
      return [];
    }

    if (filter === 'all') {
      return data.listeningValidation.questionResults;
    }

    return data.listeningValidation.questionResults.filter(result => result.status === filter);
  }, [data, filter]);

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading listening report...</p>
      </div>
    );
  }

  const { listeningValidation } = data;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Listening Report</h1>
            <p className="text-sm text-muted-foreground">Detailed answer validation review</p>
          </div>
          <Button variant="secondary" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back Home
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-primary/25 bg-gradient-card p-6"
        >
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Band</p>
              <p className="text-3xl font-bold text-primary">{data.band}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Raw Score</p>
              <p className="text-2xl font-bold text-foreground">{data.rawScore}/{data.totalQuestions}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Unanswered</p>
              <p className="text-2xl font-bold text-warning">{listeningValidation.unansweredCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Incorrect</p>
              <p className="text-2xl font-bold text-destructive">{listeningValidation.incorrectCount}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3">Section Breakdown</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {listeningValidation.sectionBreakdown.map(section => (
              <div key={section.sectionNumber} className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground">Section {section.sectionNumber}</p>
                <p className="text-sm font-medium text-foreground mb-1">{data.sectionTitles?.[section.sectionNumber] ?? 'Listening Section'}</p>
                <p className="text-sm font-semibold text-primary">{section.correct}/{section.total} correct</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Question Review</h2>
            <div className="flex items-center gap-2">
              {(['all', 'incorrect', 'unanswered'] as const).map(option => (
                <button
                  key={option}
                  onClick={() => setFilter(option)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${filter === option
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-secondary/40 text-foreground hover:border-primary/40'
                    }`}
                >
                  {option === 'all' ? 'All' : option === 'incorrect' ? 'Incorrect' : 'Unanswered'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {filteredQuestionResults.length === 0 && (
              <div className="rounded-lg border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
                No questions match this filter.
              </div>
            )}

            {filteredQuestionResults.map(result => (
              <div key={result.questionId} className="rounded-lg border border-border bg-secondary/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-primary">Q{result.questionId}</span>
                    <span className="text-xs text-muted-foreground">Section {result.sectionNumber}</span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border ${getStatusStyles(result.status)}`}>
                    {result.status === 'correct' && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {result.status === 'incorrect' && <XCircle className="w-3.5 h-3.5" />}
                    {result.status === 'unanswered' && <AlertCircle className="w-3.5 h-3.5" />}
                    {getStatusLabel(result.status)}
                  </span>
                </div>

                <p className="text-sm text-foreground mb-3">{result.questionText}</p>

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-md border border-border bg-card p-2.5">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Your Answer</p>
                    <p className="text-sm text-foreground">
                      {result.userAnswer || <span className="text-muted-foreground">No answer submitted</span>}
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-card p-2.5">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Accepted Answers</p>
                    <p className="text-sm text-foreground">{result.acceptedAnswers.join(' | ')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-3"
        >
          <Button variant="secondary" onClick={() => router.push('/dashboard')}>
            <Home className="w-4 h-4 mr-2" /> Home
          </Button>
          <Button
            onClick={() => {
              localStorage.removeItem('listeningResult');
              router.push('/dashboard');
            }}
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Retake Listening
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
