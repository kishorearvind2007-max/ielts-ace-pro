"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3, CheckCircle2, Home, MessageSquare, Mic, RotateCcw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTest } from '@/components/ielts/TestProvider';
import type { SpeakingResultSnapshot } from '@/lib/ielts-types';

export default function SpeakingResultPage() {
  const router = useRouter();
  const { state } = useTest();
  const [speakingResult, setSpeakingResult] = useState<SpeakingResultSnapshot | null>(null);

  useEffect(() => {
    const buildStateFallback = (): SpeakingResultSnapshot | null => {
      const providerSpeakingResult = state.results.find(result => result.module === 'speaking');
      if (!providerSpeakingResult) {
        return null;
      }

      return {
        band: providerSpeakingResult.band,
        criteriaScores: providerSpeakingResult.criteriaScores ?? {},
        strengths: providerSpeakingResult.strengths ?? [],
        improvements: providerSpeakingResult.improvements ?? [],
        examinerComment: providerSpeakingResult.examinerComment ?? '',
        transcripts: state.speakingTranscripts,
        evaluationMode: 'fallback',
        modelUsed: 'context-fallback',
        warning: 'Loaded from in-memory result because local snapshot was unavailable.',
        source: 'fallback',
        submittedAt: new Date().toISOString(),
      };
    };

    const setStateFallbackOrRedirect = () => {
      const fallbackResult = buildStateFallback();
      if (fallbackResult) {
        setSpeakingResult(fallbackResult);
        return;
      }

      router.push('/results');
    };

    let raw: string | null = null;
    try {
      raw = localStorage.getItem('speakingResult');
    } catch {
      setStateFallbackOrRedirect();
      return;
    }

    if (!raw) {
      setStateFallbackOrRedirect();
      return;
    }

    try {
      const parsed = JSON.parse(raw) as SpeakingResultSnapshot;
      if (!parsed || typeof parsed.band !== 'number' || !parsed.criteriaScores || !parsed.transcripts) {
        throw new Error('Invalid speaking result payload');
      }

      setSpeakingResult(parsed);
    } catch {
      setStateFallbackOrRedirect();
    }
  }, [router, state.results, state.speakingTranscripts]);

  const transcriptEntries = useMemo(() => {
    if (!speakingResult) {
      return [] as Array<{ key: string; label: string; value: string }>;
    }

    return [
      { key: 'part1', label: 'Part 1 Transcript', value: speakingResult.transcripts.part1 },
      { key: 'part2', label: 'Part 2 Transcript', value: speakingResult.transcripts.part2 },
      { key: 'part3', label: 'Part 3 Transcript', value: speakingResult.transcripts.part3 },
    ].filter(entry => entry.value.trim().length > 0);
  }, [speakingResult]);

  if (!speakingResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Loading speaking report...</p>
          <Button size="sm" variant="secondary" onClick={() => router.push('/results')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Results
          </Button>
        </div>
      </div>
    );
  }

  const criteriaEntries = Object.entries(speakingResult.criteriaScores ?? {});

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Speaking Report</h1>
            <p className="text-sm text-muted-foreground">Criterion bands, strengths, and examiner guidance.</p>
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
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Overall Band</p>
              <p className="text-3xl font-bold text-primary">{speakingResult.band}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Criteria</p>
              <p className="text-2xl font-bold text-foreground">{criteriaEntries.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Feedback Items</p>
              <p className="text-2xl font-bold text-foreground">
                {(speakingResult.strengths?.length ?? 0) + (speakingResult.improvements?.length ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Evaluation Mode</p>
              <p className="text-sm font-bold text-foreground uppercase">{speakingResult.evaluationMode}</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
            <p>Model: {speakingResult.modelUsed}</p>
            {speakingResult.warning && <p className="mt-1 text-warning">Warning: {speakingResult.warning}</p>}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Mic className="w-4 h-4 text-primary" />
            Test Craft Criteria Breakdown
          </h2>

          {criteriaEntries.length === 0 && (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              No speaking criteria details are available for this attempt.
            </div>
          )}

          <div className="space-y-3">
            {criteriaEntries.map(([criterionName, criterion]) => {
              const examples = Array.isArray(criterion.examples) ? criterion.examples : [];

              return (
                <div key={criterionName} className="rounded-lg border border-border bg-secondary/30 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="text-sm font-semibold text-foreground">{criterionName}</h3>
                    <div className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                      Band {criterion.band}
                    </div>
                  </div>
                  <p className="text-sm text-foreground mb-2">{criterion.feedback}</p>

                  {examples.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Examples</p>
                      <ul className="space-y-1">
                        {examples.map((example, index) => (
                          <li key={`${criterionName}-${index}`} className="text-sm text-foreground">• {example}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {speakingResult.strengths && speakingResult.strengths.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-success/30 bg-success/10 p-4"
          >
            <h2 className="text-sm font-semibold text-success mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Strengths
            </h2>
            <ul className="space-y-1">
              {speakingResult.strengths.map((item, index) => (
                <li key={`strength-${index}`} className="text-sm text-foreground">• {item}</li>
              ))}
            </ul>
          </motion.div>
        )}

        {speakingResult.improvements && speakingResult.improvements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-warning/30 bg-warning/10 p-4"
          >
            <h2 className="text-sm font-semibold text-warning mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Areas to Improve
            </h2>
            <ul className="space-y-1">
              {speakingResult.improvements.map((item, index) => (
                <li key={`improvement-${index}`} className="text-sm text-foreground">• {item}</li>
              ))}
            </ul>
          </motion.div>
        )}

        {speakingResult.examinerComment && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Examiner Comment
            </h2>
            <p className="text-sm text-foreground">{speakingResult.examinerComment}</p>
          </motion.div>
        )}

        {transcriptEntries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Mic className="w-4 h-4 text-primary" />
              Transcript Archive
            </h2>

            <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
              {transcriptEntries.map(entry => (
                <div key={entry.key} className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{entry.label}</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{entry.value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="flex flex-wrap justify-center gap-3"
        >
          <Button variant="secondary" onClick={() => router.push('/results')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Results
          </Button>
          <Button variant="outline" onClick={() => router.push('/result')}>
            <BarChart3 className="w-4 h-4 mr-2" /> Report Hub
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              try {
                localStorage.removeItem('speakingResult');
              } catch {
                // ignore storage cleanup failures and continue navigation
              }
              router.push('/speaking');
            }}
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Retake Speaking
          </Button>
          <Button onClick={() => router.push('/dashboard')}>
            <Home className="w-4 h-4 mr-2" /> Home
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
