"use client";

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, FileText, Headphones, Home, Mic } from 'lucide-react';
import { useTest } from '@/components/ielts/TestProvider';
import { Button } from '@/components/ui/button';
import type { TestModule } from '@/lib/ielts-types';

type ModuleCard = {
  module: TestModule;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const moduleCards: ModuleCard[] = [
  {
    module: 'listening',
    title: 'Listening Report',
    description: 'Section-wise validation, unanswered items, and accepted answers.',
    icon: Headphones,
  },
  {
    module: 'reading',
    title: 'Reading Report',
    description: 'Detailed accuracy, timing stats, and question-level analytics.',
    icon: BookOpen,
  },
  {
    module: 'writing',
    title: 'Writing Report',
    description: 'Task-level Test Craft criteria feedback with model rewrites and tips.',
    icon: FileText,
  },
  {
    module: 'speaking',
    title: 'Speaking Report',
    description: 'Band criteria, strengths, improvement points, and examiner comment.',
    icon: Mic,
  },
];

export default function ResultHubPage() {
  const router = useRouter();
  const { state } = useTest();

  const resultSet = useMemo(() => {
    return new Set(state.results.map(result => result.module));
  }, [state.results]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Detailed Reports</h1>
            <p className="text-sm text-muted-foreground">Open module-specific report views from one place.</p>
          </div>
          <Button variant="secondary" onClick={() => router.push('/results')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Results
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid gap-4 md:grid-cols-2"
        >
          {moduleCards.map(({ module, title, description, icon: Icon }) => {
            const hasSessionData = resultSet.has(module);

            return (
              <div key={module} className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/40 p-2">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${hasSessionData ? 'text-success' : 'text-warning'}`}>
                    {hasSessionData ? 'Session data ready' : 'May require fresh result data'}
                  </span>
                  <Button size="sm" onClick={() => router.push(`/result/${module}`)}>
                    Open {module.charAt(0).toUpperCase() + module.slice(1)} Report
                  </Button>
                </div>
              </div>
            );
          })}
        </motion.div>

        {state.results.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-warning/30 bg-warning/10 p-4"
          >
            <p className="text-sm text-warning">
              No module results are currently loaded in this session. Complete a module or return to the results screen to open fresh reports.
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex flex-wrap justify-center gap-3"
        >
          <Button variant="secondary" onClick={() => router.push('/results')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Results
          </Button>
          <Button onClick={() => router.push('/dashboard')}>
            <Home className="w-4 h-4 mr-2" /> Home
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
