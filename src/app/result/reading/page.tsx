"use client";

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3, CheckCircle2, Clock, Home, XCircle } from 'lucide-react';
import { useTest } from '@/components/ielts/TestProvider';
import { Button } from '@/components/ui/button';

export default function ReadingResultPage() {
  const router = useRouter();
  const { state } = useTest();

  const readingResult = useMemo(
    () => state.results.find(result => result.module === 'reading'),
    [state.results],
  );
  const detailedResults = readingResult?.detailedResults;

  useEffect(() => {
    if (!detailedResults) {
      router.push('/results');
    }
  }, [detailedResults, router]);

  if (!detailedResults) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Loading reading report...</p>
          <Button size="sm" variant="secondary" onClick={() => router.push('/results')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Results
          </Button>
        </div>
      </div>
    );
  }

  const correctCount = detailedResults.evaluations.filter(evaluation => evaluation.isCorrect).length;
  const totalQuestions = detailedResults.evaluations.length;
  const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Reading Report</h1>
            <p className="text-sm text-muted-foreground">Detailed performance analysis and question review.</p>
          </div>
          <Button variant="secondary" onClick={() => router.push('/results')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Results
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-primary/25 bg-gradient-card p-6"
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Band</p>
              <p className="text-3xl font-bold text-primary">{readingResult?.band ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Raw Score</p>
              <p className="text-2xl font-bold text-foreground">
                {readingResult?.rawScore ?? correctCount}/{readingResult?.totalQuestions ?? totalQuestions}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Accuracy</p>
              <p className="text-2xl font-bold text-success">{accuracy.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Avg Time / Q</p>
              <p className="text-2xl font-bold text-foreground">{detailedResults.timeStats.avgTimePerQuestion.toFixed(0)}s</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Speed Overview
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">Fastest Question</p>
              <p className="text-sm font-semibold text-foreground">
                {detailedResults.timeStats.fastestQuestion
                  ? `Q${detailedResults.timeStats.fastestQuestion.id} (${detailedResults.timeStats.fastestQuestion.time.toFixed(1)}s)`
                  : 'N/A'}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">Slowest Question</p>
              <p className="text-sm font-semibold text-foreground">
                {detailedResults.timeStats.slowestQuestion
                  ? `Q${detailedResults.timeStats.slowestQuestion.id} (${detailedResults.timeStats.slowestQuestion.time.toFixed(1)}s)`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </motion.div>

        {Object.keys(detailedResults.questionTypes).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <h2 className="text-sm font-semibold text-foreground mb-3">Performance by Question Type</h2>
            <div className="space-y-2">
              {Object.entries(detailedResults.questionTypes)
                .sort(([, a], [, b]) => (b.correct / b.total) - (a.correct / a.total))
                .map(([type, stats]) => {
                  const typeAccuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;

                  return (
                    <div key={type} className="flex items-center gap-3">
                      <div className="w-32 text-xs text-foreground capitalize">{type}</div>
                      <div className="flex-1 h-4 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            typeAccuracy >= 70
                              ? 'bg-success'
                              : typeAccuracy >= 50
                                ? 'bg-warning'
                                : 'bg-destructive'
                          }`}
                          style={{ width: `${typeAccuracy}%` }}
                        />
                      </div>
                      <div className="w-12 text-xs text-right font-semibold text-foreground">
                        {stats.correct}/{stats.total}
                      </div>
                    </div>
                  );
                })}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3">Question-by-Question Breakdown</h2>
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {detailedResults.evaluations.map(evaluation => (
              <div
                key={evaluation.questionId}
                className={`p-3 rounded-lg border ${
                  evaluation.isCorrect
                    ? 'bg-success/10 border-success/30'
                    : 'bg-destructive/10 border-destructive/30'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {evaluation.isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                    <span className="text-sm font-semibold text-foreground">Q{evaluation.questionId}</span>
                    <span className="text-xs text-muted-foreground">{evaluation.matchMethod}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {typeof evaluation.timeSpent === 'number' && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {evaluation.timeSpent.toFixed(1)}s
                      </span>
                    )}
                    {typeof evaluation.similarityScore === 'number' && (
                      <span>{Math.round(evaluation.similarityScore * 100)}%</span>
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  {!evaluation.isCorrect && (
                    <div>
                      <span className="text-muted-foreground">Your answer: </span>
                      <span className="text-foreground font-mono">"{evaluation.userAnswer}"</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Correct answer: </span>
                    <span className="text-foreground font-mono">"{evaluation.correctAnswer}"</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex flex-wrap justify-center gap-3"
        >
          <Button variant="secondary" onClick={() => router.push('/results')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Results
          </Button>
          <Button variant="outline" onClick={() => router.push('/result')}>
            <BarChart3 className="w-4 h-4 mr-2" /> Report Hub
          </Button>
          <Button onClick={() => router.push('/')}>
            <Home className="w-4 h-4 mr-2" /> Home
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
