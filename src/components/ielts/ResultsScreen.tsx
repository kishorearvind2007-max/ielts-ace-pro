import { motion } from 'framer-motion';
import { useTest } from './TestProvider';
import { calculateOverallBand, getBandLabel, getCEFR } from '@/lib/scoring';
import { Button } from '@/components/ui/button';
import { Award, ChevronDown, ChevronUp, Home, RotateCcw } from 'lucide-react';
import { useState } from 'react';

export function ResultsScreen() {
  const { state, dispatch, goHome } = useTest();
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const bands = state.results.map(r => r.band);
  const overallBand = bands.length > 0 ? calculateOverallBand(bands) : 0;
  const label = getBandLabel(overallBand);
  const cefr = getCEFR(overallBand);

  // Radar chart points
  const radarModules = ['Listening', 'Reading', 'Writing', 'Speaking'];
  const radarValues = radarModules.map(m => {
    const result = state.results.find(r => r.module === m.toLowerCase());
    return result?.band || 0;
  });

  const getRadarPoint = (index: number, value: number, total: number = 4) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const radius = (value / 9) * 100;
    return {
      x: 150 + radius * Math.cos(angle),
      y: 150 + radius * Math.sin(angle),
    };
  };

  const radarPoints = radarValues.map((v, i) => getRadarPoint(i, v));
  const radarPath = radarPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <Award className="w-16 h-16 text-primary mx-auto mb-4" />
          <h1 className="text-4xl font-heading font-bold text-foreground mb-2">Test Results</h1>
          <p className="text-muted-foreground">IELTS Academic Practice Test</p>
        </motion.div>

        {/* Overall Band */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-12 p-8 rounded-2xl bg-gradient-card border border-primary/30 shadow-gold"
        >
          <div className="text-7xl font-heading font-bold text-gradient-gold mb-2">{overallBand}</div>
          <div className="text-xl font-semibold text-foreground mb-1">Band {overallBand} — {label}</div>
          <div className="text-sm text-muted-foreground">CEFR Level: {cefr}</div>
        </motion.div>

        {/* Radar Chart */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex justify-center mb-12"
        >
          <svg width="300" height="300" viewBox="0 0 300 300">
            {/* Grid rings */}
            {[3, 5, 7, 9].map(level => {
              const gridPoints = radarModules.map((_, i) => getRadarPoint(i, level));
              const gridPath = gridPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
              return <path key={level} d={gridPath} fill="none" stroke="hsl(220, 20%, 20%)" strokeWidth="1" />;
            })}
            {/* Axis lines */}
            {radarModules.map((_, i) => {
              const endPoint = getRadarPoint(i, 9);
              return <line key={i} x1="150" y1="150" x2={endPoint.x} y2={endPoint.y} stroke="hsl(220, 20%, 20%)" strokeWidth="1" />;
            })}
            {/* Data */}
            <path d={radarPath} fill="hsl(42, 65%, 55%, 0.2)" stroke="hsl(42, 65%, 55%)" strokeWidth="2.5" />
            {radarPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="5" fill="hsl(42, 65%, 55%)" />
            ))}
            {/* Labels */}
            {radarModules.map((m, i) => {
              const labelPoint = getRadarPoint(i, 10.5);
              return (
                <text key={m} x={labelPoint.x} y={labelPoint.y} textAnchor="middle" dominantBaseline="middle"
                  fill="hsl(210, 20%, 92%)" fontSize="12" fontWeight="600">
                  {m}
                </text>
              );
            })}
          </svg>
        </motion.div>

        {/* Module Breakdowns */}
        <div className="space-y-4 mb-12">
          {state.results.map((result, i) => (
            <motion.div
              key={result.module}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="rounded-xl bg-card border border-border overflow-hidden"
            >
              <button
                onClick={() => setExpandedModule(expandedModule === result.module ? null : result.module)}
                className="w-full flex items-center justify-between p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-heading font-bold text-primary">{result.band}</div>
                  <div>
                    <h3 className="text-foreground font-semibold capitalize">{result.module}</h3>
                    {result.rawScore !== undefined && (
                      <p className="text-xs text-muted-foreground">{result.rawScore}/{result.totalQuestions} correct</p>
                    )}
                  </div>
                </div>
                {expandedModule === result.module ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
              </button>

              {expandedModule === result.module && (
                <div className="px-5 pb-5 border-t border-border pt-4">
                  {/* Criteria scores */}
                  {result.criteriaScores && Object.entries(result.criteriaScores).length > 0 && (
                    <div className="space-y-3 mb-4">
                      {Object.entries(result.criteriaScores).map(([key, val]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm text-foreground">{key}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-gold rounded-full" style={{ width: `${(val.band / 9) * 100}%` }} />
                            </div>
                            <span className="text-sm font-semibold text-primary w-8">{val.band}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.strengths && result.strengths.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-xs font-semibold text-success uppercase tracking-wider mb-2">Strengths</h4>
                      <ul className="space-y-1">
                        {result.strengths.map((s, i) => (
                          <li key={i} className="text-sm text-foreground">• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.improvements && result.improvements.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-xs font-semibold text-warning uppercase tracking-wider mb-2">Areas for Improvement</h4>
                      <ul className="space-y-1">
                        {result.improvements.map((s, i) => (
                          <li key={i} className="text-sm text-foreground">• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.examinerComment && (
                    <div className="p-3 rounded-lg bg-secondary">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Examiner Comment</h4>
                      <p className="text-sm text-foreground">{result.examinerComment}</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Button onClick={goHome} variant="secondary">
            <Home className="w-4 h-4 mr-2" /> Home
          </Button>
          <Button onClick={() => { dispatch({ type: 'RESET' }); goHome(); }}>
            <RotateCcw className="w-4 h-4 mr-2" /> Retake Test
          </Button>
        </div>
      </div>
    </div>
  );
}
