import { useState, useCallback } from 'react';
import { useTest } from './TestProvider';
import { TopBar } from './TopBar';
import { writingContent } from '@/data/ielts-content';
import { roundIELTS } from '@/lib/scoring';
import { useAntiCheat } from '@/hooks/use-anti-cheat';
import { Button } from '@/components/ui/button';
import { Send, Loader2, BarChart3 } from 'lucide-react';

export function WritingModule() {
  const { state, dispatch, submitModule } = useTest();
  const [currentTask, setCurrentTask] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const task = writingContent[currentTask];
  const text = currentTask === 0 ? state.writingResponses.task1 : state.writingResponses.task2;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const evaluateWithAI = useCallback(async (taskText: string, taskType: string) => {
    try {
      const response = await fetch('/api/evaluate-writing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskText,
          taskType,
        }),
      });

      if (!response.ok) throw new Error('API error');
      return await response.json();
    } catch {
      return null;
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    setIsEvaluating(true);

    let task1Band = 5.0;
    let task2Band = 5.0;
    let criteriaScores: Record<string, { band: number; feedback: string; examples: string[] }> = {};
    let strengths: string[] = [];
    let improvements: string[] = [];
    let examinerComment = '';

    const [task1Result, task2Result] = await Promise.all([
      evaluateWithAI(state.writingResponses.task1, 'Task 1 (Academic - describe a graph)'),
      evaluateWithAI(state.writingResponses.task2, 'Task 2 (Essay)'),
    ]);

    if (task1Result) task1Band = task1Result.overall_band;
    if (task2Result) {
      task2Band = task2Result.overall_band;
      criteriaScores = {
        'Task Response': task2Result.task_achievement,
        'Coherence & Cohesion': task2Result.coherence_cohesion,
        'Lexical Resource': task2Result.lexical_resource,
        'Grammatical Range': task2Result.grammatical_range,
      };
      strengths = task2Result.strengths || [];
      improvements = task2Result.improvements || [];
      examinerComment = task2Result.examiner_comment || '';
    }

    if (!task1Result && !task2Result) {
      // Fallback: estimate based on word count
      const wc1 = state.writingResponses.task1.trim().split(/\s+/).length;
      const wc2 = state.writingResponses.task2.trim().split(/\s+/).length;
      task1Band = wc1 >= 150 ? 6.0 : wc1 >= 100 ? 5.0 : 4.0;
      task2Band = wc2 >= 250 ? 6.0 : wc2 >= 150 ? 5.0 : 4.0;
      examinerComment = 'AI evaluation unavailable. Score estimated from word count. Configure ANTHROPIC_API_KEY on the server for detailed feedback.';
    }

    const writingBand = roundIELTS((task1Band + task2Band * 2) / 3);

    submitModule({
      module: 'writing',
      band: writingBand,
      criteriaScores,
      strengths,
      improvements,
      examinerComment,
    });
    setIsEvaluating(false);
  }, [state.writingResponses, evaluateWithAI, submitModule]);

  // Simple chart rendering for Task 1
  const renderChart = () => {
    if (!task.chartData) return null;
    const { labels, datasets } = task.chartData;
    const maxVal = Math.max(...datasets.flatMap(d => d.data));
    const colors = ['hsl(42, 65%, 55%)', 'hsl(200, 60%, 50%)', 'hsl(142, 60%, 45%)', 'hsl(0, 72%, 51%)'];

    return (
      <div className="p-4 rounded-xl bg-card border border-border mb-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Internet Access by Country (%)</span>
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar
        title={`Writing — Task ${currentTask + 1}`}
        totalSeconds={3600}
        onTimeUp={handleSubmit}
        tabSwitchCount={tabSwitchCount}
      />

      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-6">
        {/* Task indicator */}
        <div className="flex gap-3 mb-6">
          {[0, 1].map(i => (
            <button key={i} onClick={() => setCurrentTask(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                currentTask === i ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
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
            onPaste={e => e.preventDefault()}
            className="w-full h-80 p-4 rounded-xl bg-card border border-border text-foreground text-sm leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Write your response here..."
          />
          <div className={`absolute bottom-3 right-3 px-3 py-1 rounded-lg text-xs font-semibold ${
            wordCount >= task.minWords ? 'bg-success/20 text-success' : wordCount >= task.minWords * 0.6 ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-destructive'
          }`}>
            {wordCount} / {task.minWords} words
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end mt-6 pb-8">
          <Button onClick={handleSubmit} disabled={isEvaluating}>
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
