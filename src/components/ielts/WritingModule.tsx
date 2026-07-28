import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTest } from './TestProvider';
import { TopBar } from './TopBar';
import { writingContent } from '@/data/ielts-content';
import { roundIELTS } from '@/lib/scoring';
import { useAntiCheat } from '@/hooks/use-anti-cheat';
import { Button } from '@/components/ui/button';
import { Send, Loader2, BarChart3 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import type { WritingEvaluationApiResponse, WritingTask } from '@/lib/ielts-types';

export function WritingModule() {
  const router = useRouter();
  const { state, dispatch, submitModule } = useTest();
  const [currentTask, setCurrentTask] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<WritingTask[] | null>(null);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [taskLoadError, setTaskLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadQuestions = async () => {
      try {
        setIsLoadingTasks(true);
        setTaskLoadError(null);
        const response = await fetch('/api/generate-writing-questions', { method: 'POST' });

        if (!response.ok) {
          throw new Error('Unable to generate questions');
        }

        const data = await response.json();
        if (isMounted) {
          setGeneratedTasks([data.task1, data.task2]);
        }
      } catch (error) {
        if (isMounted) {
          setTaskLoadError(error instanceof Error ? error.message : 'Failed to load questions');
          setGeneratedTasks(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingTasks(false);
        }
      }
    };

    loadQuestions();

    return () => {
      isMounted = false;
    };
  }, []);

  const tasks = generatedTasks ?? writingContent;
  const task = tasks[currentTask];
  const text = currentTask === 0 ? state.writingResponses.task1 : state.writingResponses.task2;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const evaluateWithAI = useCallback(async (essay: string, taskType: string): Promise<WritingEvaluationApiResponse | null> => {
    const trimmedEssay = essay.trim();
    if (!trimmedEssay) {
      return null;
    }

    try {
      const response = await fetch('/api/evaluate-writing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          essay: trimmedEssay,
          taskType,
          wordCount: trimmedEssay.split(/\s+/).length,
        }),
      });

      if (!response.ok) throw new Error('API error');
      return await response.json() as WritingEvaluationApiResponse;
    } catch {
      return null;
    }
  }, []);

  const getBandFromEvaluation = useCallback((evaluation: WritingEvaluationApiResponse | null) => {
    if (!evaluation) {
      return 5.0;
    }

    return evaluation.overall_band;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isEvaluating) return;
    setIsEvaluating(true);

    try {
      let task1Band = 5.0;
      let task2Band = 5.0;
      let criteriaScores: Record<string, { band: number; feedback: string; examples: string[] }> = {};
      let strengths: string[] = [];
      let improvements: string[] = [];
      let examinerComment = '';
      let writingEvaluations: { task1: WritingEvaluationApiResponse; task2: WritingEvaluationApiResponse } | undefined;

      const [task1Result, task2Result] = await Promise.all([
        evaluateWithAI(state.writingResponses.task1, 'Task 1 (Academic - describe a graph)'),
        evaluateWithAI(state.writingResponses.task2, 'Task 2 (Essay)'),
      ]);

      if (task1Result) {
        task1Band = getBandFromEvaluation(task1Result);
      } else {
        const wc1 = state.writingResponses.task1.trim() ? state.writingResponses.task1.trim().split(/\s+/).length : 0;
        task1Band = wc1 >= 150 ? 6.0 : wc1 >= 100 ? 5.0 : 4.0;
      }
      if (task2Result) {
        task2Band = getBandFromEvaluation(task2Result);
        criteriaScores = {
          'Task Response': {
            band: task2Result.scoring.taskResponseScore,
            feedback: task2Result.scoring.taskResponseHighLevel,
            examples: task2Result.scoring.taskResponseWeaknesses,
          },
          'Coherence & Cohesion': {
            band: task2Result.scoring.coherenceScore,
            feedback: task2Result.scoring.coherenceHighLevel,
            examples: task2Result.scoring.coherenceWeaknesses,
          },
          'Lexical Resource': {
            band: task2Result.languageAnalysis.lexicalResourceScore,
            feedback: task2Result.languageAnalysis.lexicalResourceHighLevel,
            examples: task2Result.languageAnalysis.lexicalResourceWeaknesses,
          },
          'Grammatical Range': {
            band: task2Result.languageAnalysis.grammaticalRangeScore,
            feedback: task2Result.languageAnalysis.grammaticalRangeHighLevel,
            examples: task2Result.languageAnalysis.grammaticalRangeWeaknesses,
          },
        };
        strengths = task2Result.overview.strengths || [];
        improvements = task2Result.overview.weaknesses || [];
        examinerComment = task2Result.overview.overview || '';
      } else {
        const wc2 = state.writingResponses.task2.trim() ? state.writingResponses.task2.trim().split(/\s+/).length : 0;
        task2Band = wc2 >= 250 ? 6.0 : wc2 >= 150 ? 5.0 : 4.0;
      }

      if (task1Result && task2Result) {
        writingEvaluations = {
          task1: task1Result,
          task2: task2Result,
        };

        // Store results for the dedicated results page
        const resultData = {
          task1: task1Result,
          task2: task2Result,
          overallBand: roundIELTS((task1Band + task2Band * 2) / 3),
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem('writingResult', JSON.stringify(resultData));
      }

      if (!task1Result && !task2Result) {
        // Fallback: estimate based on word count
        const wc1 = state.writingResponses.task1.trim().split(/\s+/).length;
        const wc2 = state.writingResponses.task2.trim().split(/\s+/).length;
        task1Band = wc1 >= 150 ? 6.0 : wc1 >= 100 ? 5.0 : 4.0;
        task2Band = wc2 >= 250 ? 6.0 : wc2 >= 150 ? 5.0 : 4.0;
        examinerComment = 'Both AI models were unavailable. Scores were estimated from word count as a final fallback.';
      }

      const writingBand = roundIELTS((task1Band + task2Band * 2) / 3);

      submitModule({
        module: 'writing',
        band: writingBand,
        criteriaScores,
        strengths,
        improvements,
        examinerComment,
        writingEvaluations,
      });

      // Navigate to dedicated results page if we have AI evaluations
      if (task1Result && task2Result) {
        const sessionId = state.sessionId || localStorage.getItem('currentSessionId') || '';
        router.push(`/result/writing${sessionId ? `?testId=${sessionId}` : ''}`);
      }
    } finally {
      setIsEvaluating(false);
    }
  }, [isEvaluating, state.writingResponses, evaluateWithAI, submitModule, getBandFromEvaluation, router]);

  // Simple chart rendering for Task 1
  const renderChart = () => {
    if (!task.chartData) return null;
    const { labels, datasets } = task.chartData;
    const colors = ['hsl(42, 65%, 55%)', 'hsl(200, 60%, 50%)', 'hsl(142, 60%, 45%)', 'hsl(0, 72%, 51%)'];
    const inferredChartType = labels.every(label => /^\d{4}$/.test(label)) ? 'line' : 'bar';
    const chartType = task.chartType ?? inferredChartType;

    if (chartType === 'bar') {
      const series = datasets.map((ds, index) => ({
        key: `series${index + 1}`,
        label: ds.label,
        color: colors[index % colors.length],
      }));

      const chartRows = labels.map((label, index) => {
        const row: Record<string, number | string> = { category: label };
        series.forEach((item, i) => {
          row[item.key] = datasets[i]?.data[index] ?? 0;
        });
        return row;
      });

      return (
        <div className="p-4 rounded-xl bg-card border border-border mb-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Task 1 Data ({chartType})</span>
          </div>
          <ChartContainer
            config={Object.fromEntries(series.map(item => [item.key, { label: item.label, color: item.color }]))}
            className="h-64 w-full"
          >
            <BarChart data={chartRows} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="category" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {series.map(item => (
                <Bar key={item.key} dataKey={item.key} fill={`var(--color-${item.key})`} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ChartContainer>
        </div>
      );
    }

    if (chartType !== 'line') {
      return (
        <div className="p-4 rounded-xl bg-card border border-border mb-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Task 1 Data ({chartType})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-foreground">
              <thead>
                <tr className="text-left border-b border-border">
                  <th className="py-2 pr-3">Category</th>
                  {datasets.map(ds => (
                    <th key={ds.label} className="py-2 pr-3">{ds.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {labels.map((label, index) => (
                  <tr key={label} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{label}</td>
                    {datasets.map(ds => (
                      <td key={`${ds.label}-${label}`} className="py-2 pr-3">{ds.data[index]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 rounded-xl bg-card border border-border mb-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Task 1 Data (line)</span>
        </div>
        <div className="relative h-48">
          <svg viewBox="0 0 600 200" className="w-full h-full">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map(v => (
              <g key={v}>
                <line x1="50" y1={180 - v * 1.7} x2="580" y2={180 - v * 1.7} stroke="hsl(220, 20%, 20%)" strokeWidth="0.5" />
                <text x="45" y={184 - v * 1.7} textAnchor="end" fill="hsl(215, 15%, 55%)" fontSize="10">{v}</text>
              </g>
            ))}
            {/* Lines */}
            {datasets.map((ds, di) => {
              const points = ds.data.map((val, i) => `${50 + i * 106},${180 - val * 1.7}`).join(' ');
              return (
                <g key={ds.label}>
                  <polyline points={points} fill="none" stroke={colors[di]} strokeWidth="2.5" />
                  {ds.data.map((val, i) => (
                    <circle key={i} cx={50 + i * 106} cy={180 - val * 1.7} r="3" fill={colors[di]} />
                  ))}
                </g>
              );
            })}
            {/* X labels */}
            {labels.map((l, i) => (
              <text key={l} x={50 + i * 106} y="198" textAnchor="middle" fill="hsl(215, 15%, 55%)" fontSize="10">{l}</text>
            ))}
          </svg>
        </div>
        <div className="flex flex-wrap gap-4 mt-2">
          {datasets.map((ds, i) => (
            <div key={ds.label} className="flex items-center gap-2 text-xs text-foreground">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i] }} />
              {ds.label}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const { tabSwitchCount } = useAntiCheat({ onAutoSubmit: handleSubmit });

  if (isLoadingTasks && !generatedTasks) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TopBar
          title="Writing — Loading"
          totalSeconds={3600}
          onTimeUp={handleSubmit}
          tabSwitchCount={tabSwitchCount}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating writing questions...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar
        title={`Writing — Task ${currentTask + 1}`}
        totalSeconds={3600}
        onTimeUp={handleSubmit}
        tabSwitchCount={tabSwitchCount}
      />

      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-6">
        {taskLoadError && (
          <div className="mb-4 text-xs text-warning">Using default questions: {taskLoadError}</div>
        )}
        {/* Task indicator */}
        <div className="flex gap-3 mb-6">
          {[0, 1].map(i => (
            <button key={i} onClick={() => setCurrentTask(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${currentTask === i ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                }`}>
              Task {i + 1} ({writingContent[i].recommendedMinutes} min)
            </button>
          ))}
        </div>

        {/* Chart for Task 1 */}
        {currentTask === 0 && renderChart()}

        {/* Prompt */}
        <div className="p-4 rounded-xl bg-card border border-border mb-4">
          <p className="text-sm text-foreground leading-relaxed">{task.prompt}</p>
        </div>

        {/* Text area */}
        <div className="relative">
          <textarea
            value={text}
            onChange={e => dispatch({ type: 'SET_WRITING', task: currentTask === 0 ? 'task1' : 'task2', text: e.target.value })}
            data-allow-paste="true"
            className="w-full h-80 p-4 rounded-xl bg-card border border-border text-foreground text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Write your response here..."
          />
          <div className={`absolute bottom-3 right-3 px-3 py-1 rounded-lg text-xs font-semibold ${wordCount >= task.minWords ? 'bg-success/20 text-success' : wordCount >= task.minWords * 0.6 ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'
            }`}>
            {wordCount} / {task.minWords} words
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end mt-6 pb-8">
          <Button onClick={() => void handleSubmit()} disabled={isEvaluating}>
            {isEvaluating ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Evaluating...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Submit Writing</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
