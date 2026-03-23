import { motion } from 'framer-motion';
import { useTest } from './TestProvider';
import { calculateOverallBand, getBandLabel, getCEFR } from '@/lib/scoring';
import { Button } from '@/components/ui/button';
import { Award, ChevronDown, ChevronUp, Home, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { WritingEvaluationApiResponse } from '@/lib/ielts-types';

function renderList(items: string[], keyPrefix: string) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-1">
      {items.map((item, index) => (
        <li key={`${keyPrefix}-${index}`} className="text-sm text-foreground">• {item}</li>
      ))}
    </ul>
  );
}

function renderVocabulary(
  items: WritingEvaluationApiResponse['improvement']['vocabularyExplanations'],
  keyPrefix: string,
  title: string,
) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h6>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${keyPrefix}-vocab-${index}`} className="rounded-md border border-border bg-card p-3">
            <p className="text-sm font-semibold text-foreground">{item.word}</p>
            <p className="text-xs text-muted-foreground">Meaning: {item.meaning}</p>
            <p className="text-xs text-muted-foreground">Usage: {item.usage}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderWritingTaskDetails(title: string, evaluation: WritingEvaluationApiResponse) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold text-foreground">{title}</h5>
        <span className="text-xs text-muted-foreground">Band {evaluation.overall_band} • {evaluation.evaluation_mode === 'ai' ? evaluation.model_used : 'Fallback'}</span>
      </div>

      <div>
        <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Overview</h6>
        <p className="text-sm text-foreground mb-2">{evaluation.overview.overview}</p>
        {evaluation.overview.strengths.length > 0 && (
          <div className="mb-2">
            <p className="text-xs font-semibold text-success uppercase tracking-wider mb-1">Strengths</p>
            {renderList(evaluation.overview.strengths, `${title}-overview-strength`) }
          </div>
        )}
        {evaluation.overview.weaknesses.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-warning uppercase tracking-wider mb-1">Weaknesses</p>
            {renderList(evaluation.overview.weaknesses, `${title}-overview-weakness`) }
          </div>
        )}
      </div>

      <div>
        <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Criterion Scores</h6>
        <div className="space-y-2">
          {[
            { label: 'Task Response', score: evaluation.scoring.taskResponseScore, summary: evaluation.scoring.taskResponseHighLevel },
            { label: 'Coherence & Cohesion', score: evaluation.scoring.coherenceScore, summary: evaluation.scoring.coherenceHighLevel },
            { label: 'Lexical Resource', score: evaluation.languageAnalysis.lexicalResourceScore, summary: evaluation.languageAnalysis.lexicalResourceHighLevel },
            { label: 'Grammatical Range & Accuracy', score: evaluation.languageAnalysis.grammaticalRangeScore, summary: evaluation.languageAnalysis.grammaticalRangeHighLevel },
          ].map(item => (
            <div key={`${title}-${item.label}`}>
              <div className="flex items-center justify-between text-sm text-foreground mb-1">
                <span>{item.label}</span>
                <span className="font-semibold text-primary">{item.score}</span>
              </div>
              <div className="w-full h-2 bg-card rounded-full overflow-hidden mb-1">
                <div className="h-full bg-gradient-gold rounded-full" style={{ width: `${(item.score / 9) * 100}%` }} />
              </div>
              {item.summary && <p className="text-xs text-muted-foreground">{item.summary}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Task Response Strengths</h6>
          {renderList(evaluation.scoring.taskResponseStrengths, `${title}-tr-strength`) }
        </div>
        <div>
          <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Task Response Weaknesses</h6>
          {renderList(evaluation.scoring.taskResponseWeaknesses, `${title}-tr-weakness`) }
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Coherence Strengths</h6>
          {renderList(evaluation.scoring.coherenceStrengths, `${title}-coh-strength`) }
        </div>
        <div>
          <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Coherence Weaknesses</h6>
          {renderList(evaluation.scoring.coherenceWeaknesses, `${title}-coh-weakness`) }
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Lexical Strengths</h6>
          {renderList(evaluation.languageAnalysis.lexicalResourceStrengths, `${title}-lex-strength`) }
        </div>
        <div>
          <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Lexical Weaknesses</h6>
          {renderList(evaluation.languageAnalysis.lexicalResourceWeaknesses, `${title}-lex-weakness`) }
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Grammar Strengths</h6>
          {renderList(evaluation.languageAnalysis.grammaticalRangeStrengths, `${title}-gram-strength`) }
        </div>
        <div>
          <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Grammar Weaknesses</h6>
          {renderList(evaluation.languageAnalysis.grammaticalRangeWeaknesses, `${title}-gram-weakness`) }
        </div>
      </div>

      {evaluation.languageAnalysis.keyChanges.length > 0 && (
        <div>
          <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Key Changes</h6>
          {renderList(evaluation.languageAnalysis.keyChanges, `${title}-key-change`) }
        </div>
      )}

      {evaluation.languageAnalysis.correctedEssay && (
        <div>
          <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Corrected Essay</h6>
          <p className="text-sm text-foreground whitespace-pre-wrap">{evaluation.languageAnalysis.correctedEssay}</p>
        </div>
      )}

      {evaluation.improvement.improvedEssay && (
        <div>
          <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Band 8-9 Rewrite</h6>
          <p className="text-sm text-foreground whitespace-pre-wrap">{evaluation.improvement.improvedEssay}</p>
        </div>
      )}

      {renderVocabulary(
        evaluation.improvement.vocabularyExplanations,
        `${title}-vocabulary`,
        'Vocabulary Explanations',
      )}

      {evaluation.improvement.expandIdeas.length > 0 && (
        <div>
          <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">How to Expand Ideas</h6>
          {renderList(evaluation.improvement.expandIdeas, `${title}-expand`) }
        </div>
      )}

      {evaluation.improvement.alternativeDirection && (
        <div>
          <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Alternative Direction</h6>
          <p className="text-sm text-foreground whitespace-pre-wrap">{evaluation.improvement.alternativeDirection}</p>
        </div>
      )}

      {evaluation.improvement.alternativeEssay && (
        <div>
          <h6 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Alternative Essay</h6>
          <p className="text-sm text-foreground whitespace-pre-wrap">{evaluation.improvement.alternativeEssay}</p>
        </div>
      )}

      {renderVocabulary(
        evaluation.improvement.alternativeVocabulary,
        `${title}-alt-vocabulary`,
        'Alternative Vocabulary',
      )}

      {evaluation.warning && (
        <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
          <p className="text-xs text-warning">{evaluation.warning}</p>
        </div>
      )}
    </div>
  );
}

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
                  {result.module === 'writing' && result.writingEvaluations && (
                    <div className="space-y-4 mb-4">
                      {renderWritingTaskDetails('Task 1 (Academic - describe a graph)', result.writingEvaluations.task1)}
                      {renderWritingTaskDetails('Task 2 (Essay)', result.writingEvaluations.task2)}
                    </div>
                  )}

                  {/* Criteria scores */}
                  {result.criteriaScores && Object.entries(result.criteriaScores).length > 0 && result.module !== 'writing' && (
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
