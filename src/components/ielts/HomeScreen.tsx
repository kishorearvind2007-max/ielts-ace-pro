import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTest } from './TestProvider';
import {
  Headphones,
  BookOpen,
  PenTool,
  Mic,
  Play,
  Award,
  Medal,
  Download,
  Loader2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { TestModule } from '@/lib/ielts-types';
import { calculateOverallBand } from '@/lib/scoring';

const CERTIFICATE_MIN_BAND_THRESHOLD = 2;

const modules: { id: TestModule; title: string; icon: React.ReactNode; time: string; questions: string; description: string }[] = [
  { id: 'listening', title: 'Listening', icon: <Headphones className="w-8 h-8" />, time: '40 min', questions: '40 questions', description: '4 sections with increasing difficulty. Audio played via text-to-speech.' },
  { id: 'reading', title: 'Reading', icon: <BookOpen className="w-8 h-8" />, time: '60 min', questions: '40 questions', description: '3 academic passages with various question types.' },
  { id: 'writing', title: 'Writing', icon: <PenTool className="w-8 h-8" />, time: '60 min', questions: '2 tasks', description: 'Task 1: Describe a graph. Task 2: Opinion essay.' },
  { id: 'speaking', title: 'Speaking', icon: <Mic className="w-8 h-8" />, time: '11-14 min', questions: '3 parts', description: 'Real-time speech recognition with AI evaluation.' },
];

export function HomeScreen() {
  const router = useRouter();
  const { state, startModule, showResults, resetAll } = useTest();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isGeneratingCertificate, setIsGeneratingCertificate] = useState(false);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [certificatePreviewUrl, setCertificatePreviewUrl] = useState<string | null>(null);
  const [certificateDownloadUrl, setCertificateDownloadUrl] = useState<string | null>(null);
  const completedModules = state.results.map(r => r.module);
  const allDone = completedModules.length === 4;

  const moduleBands: Record<TestModule, number | null> = {
    listening: state.results.find(r => r.module === 'listening')?.band ?? null,
    reading: state.results.find(r => r.module === 'reading')?.band ?? null,
    writing: state.results.find(r => r.module === 'writing')?.band ?? null,
    speaking: state.results.find(r => r.module === 'speaking')?.band ?? null,
  };

  const listeningBand = moduleBands.listening ?? 0;
  const readingBand = moduleBands.reading ?? 0;
  const writingBand = moduleBands.writing ?? 0;
  const speakingBand = moduleBands.speaking ?? 0;

  const hasAllModuleBands = Object.values(moduleBands).every(
    (band): band is number => typeof band === 'number' && Number.isFinite(band),
  );

  const overallBand = hasAllModuleBands
    ? calculateOverallBand([listeningBand, readingBand, writingBand, speakingBand])
    : null;

  const isEligibleForCertificate = hasAllModuleBands
    && listeningBand >= CERTIFICATE_MIN_BAND_THRESHOLD
    && readingBand >= CERTIFICATE_MIN_BAND_THRESHOLD
    && writingBand >= CERTIFICATE_MIN_BAND_THRESHOLD
    && speakingBand >= CERTIFICATE_MIN_BAND_THRESHOLD
    && (overallBand ?? 0) >= CERTIFICATE_MIN_BAND_THRESHOLD;

  const summaryBands = [
    { key: 'listening', label: 'Listening', value: moduleBands.listening },
    { key: 'reading', label: 'Reading', value: moduleBands.reading },
    { key: 'writing', label: 'Writing', value: moduleBands.writing },
    { key: 'speaking', label: 'Speaking', value: moduleBands.speaking },
    { key: 'overall', label: 'Overall', value: overallBand },
  ];

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await signOut();
      resetAll();
      localStorage.removeItem('writingResult');
      localStorage.removeItem('listeningResult');
      localStorage.removeItem('ielts-test-results');
      router.push('/auth/login');
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleGenerateCertificate() {
    setCertificateError(null);

    if (!hasAllModuleBands || overallBand === null) {
      const message = 'Complete all four modules to unlock certificate generation.';
      setCertificateError(message);
      toast({
        title: 'Complete all modules first',
        description: message,
        variant: 'destructive',
      });
      return;
    }

    if (!isEligibleForCertificate) {
      const message = `Certificate requires at least Band ${CERTIFICATE_MIN_BAND_THRESHOLD} in every module and overall.`;
      setCertificateError(message);
      toast({
        title: 'Eligibility threshold not met',
        description: message,
        variant: 'destructive',
      });
      return;
    }

    setIsGeneratingCertificate(true);
    try {
      const response = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // No manual scores needed anymore
      });

      const payload = await response.json();
      if (!response.ok) {
        let baseMessage = typeof payload?.message === 'string'
          ? payload.message
          : 'Certificate generation failed. Please try again.';

        if (payload?.error === 'NO_COMPLETED_TEST') {
          baseMessage = 'No completed test found in database. Please complete and finalize all four modules first.';
        }

        if (payload?.error === 'INCOMPLETE_RESULTS') {
          baseMessage = 'Test results are incomplete. Ensure all modules are evaluated and finalized.';
        }

        const details = typeof payload?.details === 'string' ? payload.details : null;
        const message = details ? `${baseMessage} (${details})` : baseMessage;
        throw new Error(message);
      }

      const previewUrl = typeof payload?.previewUrl === 'string' ? payload.previewUrl : null;
      const downloadUrl = typeof payload?.downloadUrl === 'string' ? payload.downloadUrl : null;
      setCertificatePreviewUrl(previewUrl);
      setCertificateDownloadUrl(downloadUrl);

      toast({
        title: 'Certificate generated',
        description: 'Your certificate has been issued successfully.',
      });

      const launchUrl = downloadUrl ?? previewUrl;
      if (launchUrl) {
        window.open(launchUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Unable to generate certificate right now.';

      setCertificateError(message);
      toast({
        title: 'Certificate generation failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingCertificate(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-semibold text-foreground">{user?.fullName || 'Student'}</span> ({user?.registerNumber || 'N/A'})
          </p>
          <Button variant="secondary" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? 'Signing out...' : 'Sign out'}
          </Button>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary text-primary text-sm font-medium mb-6">
            <Award className="w-4 h-4" />
            IELTS Practice Test
          </div>
          <h1 className="text-5xl font-heading font-bold mb-4">
            <span className="text-gradient-gold">Test Craft</span>{' '}
            <span className="text-foreground">Academic Test</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Complete all four modules for a comprehensive assessment with AI-powered evaluation.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8 p-6 rounded-xl bg-card border border-border"
        >
          <h3 className="text-sm font-semibold text-foreground mb-2">AI Evaluation Enabled</h3>
          <p className="text-xs text-muted-foreground">
            Writing and Speaking modules are evaluated through secure server routes. Configure required AI keys in the server environment.
          </p>
        </motion.div>

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {modules.map((mod, i) => {
            const isComplete = completedModules.includes(mod.id);
            const result = state.results.find(r => r.module === mod.id);

            return (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`relative p-6 rounded-xl border bg-gradient-card shadow-card transition-all hover:shadow-gold hover:border-primary/30 ${isComplete ? 'border-success/40' : 'border-border'
                  }`}
              >
                {isComplete && (
                  <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-success/20 text-success text-xs font-semibold">
                    Band {result?.band}
                  </div>
                )}
                <div className="text-primary mb-4">{mod.icon}</div>
                <h3 className="text-xl font-heading font-bold text-foreground mb-1">{mod.title}</h3>
                <div className="flex gap-3 text-sm text-muted-foreground mb-3">
                  <span>{mod.time}</span>
                  <span>•</span>
                  <span>{mod.questions}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-5">{mod.description}</p>
                <Button
                  onClick={() => startModule(mod.id)}
                  disabled={isComplete}
                  variant={isComplete ? 'secondary' : 'default'}
                  className="w-full"
                >
                  {isComplete ? 'Completed' : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start {mod.title}
                    </>
                  )}
                </Button>
              </motion.div>
            );
          })}
        </div>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="mx-auto w-full max-w-3xl rounded-2xl border border-primary/30 bg-gradient-card p-6 shadow-gold sm:p-8">
            <div className="mb-5 text-center">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                <Medal className="h-4 w-4" />
                Certificate Unlock
              </div>
              <h2 className="text-2xl font-heading font-bold text-foreground">Generate Your IELTS Certificate</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                You need Band {CERTIFICATE_MIN_BAND_THRESHOLD} or higher in Listening, Reading, Writing, Speaking, and Overall.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {summaryBands.map(item => {
                const bandValue = typeof item.value === 'number' && Number.isFinite(item.value)
                  ? item.value
                  : null;
                const hasValue = bandValue !== null;
                const meetsThreshold = hasValue && bandValue >= CERTIFICATE_MIN_BAND_THRESHOLD;

                return (
                  <div
                    key={item.key}
                    className={`rounded-xl border px-3 py-3 text-center ${
                      hasValue
                        ? meetsThreshold
                          ? 'border-success/40 bg-success/10'
                          : 'border-destructive/40 bg-destructive/10'
                        : 'border-border bg-background/60'
                    }`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-lg font-bold text-foreground">
                      {hasValue ? bandValue.toFixed(1) : '--'}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-center">
              <Button
                size="lg"
                onClick={handleGenerateCertificate}
                disabled={!allDone || isGeneratingCertificate}
                className="w-full bg-gradient-gold px-8 py-6 text-base font-semibold text-primary-foreground shadow-gold sm:w-auto"
              >
                {isGeneratingCertificate ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Certificate...
                  </>
                ) : (
                  <>
                    <Medal className="mr-2 h-5 w-5" />
                    Generate Certificate
                  </>
                )}
              </Button>
            </div>

            {!allDone && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Complete all modules to activate certificate generation.
              </p>
            )}

            {allDone && !isEligibleForCertificate && (
              <p className="mt-3 flex items-center justify-center gap-1 text-center text-xs text-destructive">
                <AlertCircle className="h-4 w-4" />
                Current scores do not meet the minimum Band {CERTIFICATE_MIN_BAND_THRESHOLD} requirement.
              </p>
            )}

            {allDone && isEligibleForCertificate && !certificateError && (
              <p className="mt-3 flex items-center justify-center gap-1 text-center text-xs text-success">
                <CheckCircle2 className="h-4 w-4" />
                You meet the eligibility threshold and can generate your certificate.
              </p>
            )}

            {certificateError && (
              <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                {certificateError}
              </p>
            )}

            {(certificateDownloadUrl || certificatePreviewUrl) && (
              <div className="mt-4 text-center">
                <div className="flex flex-col items-center gap-2">
                  {certificateDownloadUrl && (
                    <a
                      href={certificateDownloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      Download latest certificate PDF
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                  {certificatePreviewUrl && (
                    <a
                      href={certificatePreviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary/90 underline-offset-4 hover:underline"
                    >
                      Open latest certificate preview
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.section>

        {/* Results button */}
        {allDone && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <Button onClick={showResults} size="lg" className="bg-gradient-gold text-primary-foreground shadow-gold text-lg px-10 py-6">
              <Award className="w-5 h-5 mr-2" />
              View Overall Results
            </Button>
          </motion.div>
        )}

        {completedModules.length > 0 && !allDone && (
          <div className="text-center">
            <button onClick={showResults} className="text-sm text-muted-foreground hover:text-primary underline">
              View partial results ({completedModules.length}/4 modules completed)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
