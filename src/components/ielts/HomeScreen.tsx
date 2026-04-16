import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTest } from './TestProvider';
import { Headphones, BookOpen, PenTool, Mic, Play, Award } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import type { TestModule } from '@/lib/ielts-types';

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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const completedModules = state.results.map(r => r.module);
  const allDone = completedModules.length === 4;

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
            <span className="text-gradient-gold">IELTS</span>{' '}
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
