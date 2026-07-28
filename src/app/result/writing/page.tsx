"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Award,
    ArrowLeft,
    BookOpen,
    CheckCircle2,
    AlertCircle,
    FileText,
    Sparkles,
    ChevronDown,
    ChevronUp,
    PenLine,
    RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WritingEvaluationApiResponse } from "@/lib/ielts-types";

interface WritingResultData {
    task1: WritingEvaluationApiResponse;
    task2: WritingEvaluationApiResponse;
    overallBand: number;
    timestamp: string;
}

function getBandColor(band: number): string {
    if (band >= 7) return "text-green-500";
    if (band >= 5) return "text-yellow-500";
    return "text-red-500";
}

function getBandBgColor(band: number): string {
    if (band >= 7) return "bg-green-500/10 border-green-500/30";
    if (band >= 5) return "bg-yellow-500/10 border-yellow-500/30";
    return "bg-red-500/10 border-red-500/30";
}

function CriterionCard({
    label,
    score,
    summary,
    strengths,
    weaknesses,
}: {
    label: string;
    score: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${getBandBgColor(score)} ${getBandColor(score)}`}
                    >
                        {score}
                    </div>
                    <div className="text-left">
                        <h4 className="font-semibold text-foreground">{label}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-1">{summary}</p>
                    </div>
                </div>
                {expanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
            </button>
            {expanded && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                    <p className="text-sm text-foreground">{summary}</p>
                    {strengths.length > 0 && (
                        <div>
                            <h5 className="text-xs font-semibold text-green-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Strengths
                            </h5>
                            <ul className="space-y-1">
                                {strengths.map((s, i) => (
                                    <li key={i} className="text-sm text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-green-500">
                                        {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {weaknesses.length > 0 && (
                        <div>
                            <h5 className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Areas to Improve
                            </h5>
                            <ul className="space-y-1">
                                {weaknesses.map((w, i) => (
                                    <li key={i} className="text-sm text-muted-foreground pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-orange-500">
                                        {w}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function TaskEvaluation({
    title,
    taskNumber,
    evaluation,
}: {
    title: string;
    taskNumber: 1 | 2;
    evaluation: WritingEvaluationApiResponse;
}) {
    const [showCorrected, setShowCorrected] = useState(false);
    const [showImproved, setShowImproved] = useState(false);
    const [showAlternative, setShowAlternative] = useState(false);

    const criteria = [
        {
            label: "Task Response",
            score: evaluation.scoring.taskResponseScore,
            summary: evaluation.scoring.taskResponseHighLevel,
            strengths: evaluation.scoring.taskResponseStrengths,
            weaknesses: evaluation.scoring.taskResponseWeaknesses,
        },
        {
            label: "Coherence & Cohesion",
            score: evaluation.scoring.coherenceScore,
            summary: evaluation.scoring.coherenceHighLevel,
            strengths: evaluation.scoring.coherenceStrengths,
            weaknesses: evaluation.scoring.coherenceWeaknesses,
        },
        {
            label: "Lexical Resource",
            score: evaluation.languageAnalysis.lexicalResourceScore,
            summary: evaluation.languageAnalysis.lexicalResourceHighLevel,
            strengths: evaluation.languageAnalysis.lexicalResourceStrengths,
            weaknesses: evaluation.languageAnalysis.lexicalResourceWeaknesses,
        },
        {
            label: "Grammatical Range & Accuracy",
            score: evaluation.languageAnalysis.grammaticalRangeScore,
            summary: evaluation.languageAnalysis.grammaticalRangeHighLevel,
            strengths: evaluation.languageAnalysis.grammaticalRangeStrengths,
            weaknesses: evaluation.languageAnalysis.grammaticalRangeWeaknesses,
        },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: taskNumber * 0.2 }}
            className="space-y-6"
        >
            {/* Task Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        {taskNumber === 1 ? (
                            <FileText className="w-5 h-5 text-primary" />
                        ) : (
                            <PenLine className="w-5 h-5 text-primary" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                        <p className="text-xs text-muted-foreground">{evaluation.word_count} words</p>
                    </div>
                </div>
                <div className={`text-3xl font-bold ${getBandColor(evaluation.overall_band)}`}>
                    {evaluation.overall_band}
                </div>
            </div>

            {/* Overview */}
            <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                <p className="text-sm text-foreground">{evaluation.overview.overview}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {evaluation.overview.strengths.slice(0, 2).map((s, i) => (
                        <span key={i} className="px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                            {s}
                        </span>
                    ))}
                    {evaluation.overview.weaknesses.slice(0, 2).map((w, i) => (
                        <span key={i} className="px-2 py-1 text-xs rounded-full bg-orange-500/10 text-orange-500 border border-orange-500/20">
                            {w}
                        </span>
                    ))}
                </div>
            </div>

            {/* Criteria Cards */}
            <div className="grid gap-3">
                {criteria.map((c) => (
                    <CriterionCard key={c.label} {...c} />
                ))}
            </div>

            {/* Essay Sections */}
            <div className="space-y-3">
                {/* Corrected Essay */}
                {evaluation.languageAnalysis.correctedEssay && (
                    <div className="rounded-xl border border-border overflow-hidden">
                        <button
                            onClick={() => setShowCorrected(!showCorrected)}
                            className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                <span className="font-medium text-foreground">Corrected Essay</span>
                            </div>
                            {showCorrected ? (
                                <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                        </button>
                        {showCorrected && (
                            <div className="px-4 pb-4 border-t border-border pt-3">
                                {evaluation.languageAnalysis.keyChanges.length > 0 && (
                                    <div className="mb-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                        <h5 className="text-xs font-semibold text-blue-500 uppercase mb-2">Key Changes</h5>
                                        <ul className="space-y-1">
                                            {evaluation.languageAnalysis.keyChanges.map((c, i) => (
                                                <li key={i} className="text-sm text-foreground">• {c}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                    {evaluation.languageAnalysis.correctedEssay}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Improved Essay */}
                {evaluation.improvement.improvedEssay && (
                    <div className="rounded-xl border border-border overflow-hidden">
                        <button
                            onClick={() => setShowImproved(!showImproved)}
                            className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-primary" />
                                <span className="font-medium text-foreground">Band 8-9 Model Essay</span>
                            </div>
                            {showImproved ? (
                                <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                        </button>
                        {showImproved && (
                            <div className="px-4 pb-4 border-t border-border pt-3">
                                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed mb-4">
                                    {evaluation.improvement.improvedEssay}
                                </p>
                                {evaluation.improvement.vocabularyExplanations.length > 0 && (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {evaluation.improvement.vocabularyExplanations.map((v, i) => (
                                            <div key={i} className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                                                <p className="font-semibold text-primary text-sm">{v.word}</p>
                                                <p className="text-xs text-muted-foreground">{v.meaning}</p>
                                                <p className="text-xs text-foreground mt-1 italic">&quot;{v.usage}&quot;</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Alternative Essay (Task 2 only) */}
                {taskNumber === 2 && evaluation.improvement.alternativeEssay && (
                    <div className="rounded-xl border border-border overflow-hidden">
                        <button
                            onClick={() => setShowAlternative(!showAlternative)}
                            className="w-full p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-purple-500" />
                                <span className="font-medium text-foreground">Alternative Approach</span>
                            </div>
                            {showAlternative ? (
                                <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                        </button>
                        {showAlternative && (
                            <div className="px-4 pb-4 border-t border-border pt-3">
                                {evaluation.improvement.alternativeDirection && (
                                    <div className="mb-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                        <p className="text-sm text-foreground">{evaluation.improvement.alternativeDirection}</p>
                                    </div>
                                )}
                                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed mb-4">
                                    {evaluation.improvement.alternativeEssay}
                                </p>
                                {evaluation.improvement.alternativeVocabulary.length > 0 && (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {evaluation.improvement.alternativeVocabulary.map((v, i) => (
                                            <div key={i} className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                                                <p className="font-semibold text-purple-500 text-sm">{v.word}</p>
                                                <p className="text-xs text-muted-foreground">{v.meaning}</p>
                                                <p className="text-xs text-foreground mt-1 italic">&quot;{v.usage}&quot;</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Expand Ideas (Task 2 only) */}
                {taskNumber === 2 && evaluation.improvement.expandIdeas.length > 0 && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 to-purple-500/5 border border-primary/20">
                        <h5 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary" />
                            Ideas to Develop Further
                        </h5>
                        <ul className="space-y-2">
                            {evaluation.improvement.expandIdeas.map((idea, i) => (
                                <li key={i} className="text-sm text-muted-foreground pl-4 relative before:content-['→'] before:absolute before:left-0 before:text-primary">
                                    {idea}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Warning */}
            {evaluation.warning && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-xs text-yellow-500">{evaluation.warning}</p>
                </div>
            )}
        </motion.div>
    );
}

export default function WritingResultPage() {
    const router = useRouter();
    const [data, setData] = useState<WritingResultData | null>(null);
    const [activeTask, setActiveTask] = useState<1 | 2>(1);

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
                        const apiData = await response.json();
                        const moduleResult = apiData.attempt?.moduleResults?.writing;
                        if (moduleResult?.writingEvaluations?.task1 && moduleResult?.writingEvaluations?.task2) {
                            const resultData: WritingResultData = {
                                task1: moduleResult.writingEvaluations.task1,
                                task2: moduleResult.writingEvaluations.task2,
                                overallBand: moduleResult.band,
                                timestamp: apiData.attempt.updatedAt || new Date().toISOString(),
                            };
                            setData(resultData);
                            return;
                        }
                    }
                } catch (error) {
                    console.warn('[writing-result] Failed to fetch from database:', error);
                }
            }

            // Fallback to localStorage
            const stored = localStorage.getItem("writingResult");
            if (stored) {
                try {
                    setData(JSON.parse(stored));
                } catch {
                    router.push("/dashboard");
                }
            } else {
                router.push("/dashboard");
            }
        };

        loadResults();
    }, [router]);

    if (!data) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Loading results...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="max-w-3xl mx-auto px-4 py-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
                        <Award className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold text-foreground mb-2">Writing Results</h1>
                    <p className="text-muted-foreground text-sm">Test Craft Academic Writing Evaluation</p>
                </motion.div>

                {/* Overall Band Score */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-purple-500/5 to-blue-500/10 border border-primary/20"
                >
                    <div className="text-center">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Overall Band Score</p>
                        <div className={`text-6xl font-bold mb-2 ${getBandColor(data.overallBand)}`}>
                            {data.overallBand}
                        </div>
                        <div className="flex justify-center gap-8 mt-4">
                            <div className="text-center">
                                <div className={`text-2xl font-bold ${getBandColor(data.task1.overall_band)}`}>
                                    {data.task1.overall_band}
                                </div>
                                <p className="text-xs text-muted-foreground">Task 1</p>
                            </div>
                            <div className="w-px bg-border" />
                            <div className="text-center">
                                <div className={`text-2xl font-bold ${getBandColor(data.task2.overall_band)}`}>
                                    {data.task2.overall_band}
                                </div>
                                <p className="text-xs text-muted-foreground">Task 2</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Task Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTask(1)}
                        className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${activeTask === 1
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Task 1 — Graph
                    </button>
                    <button
                        onClick={() => setActiveTask(2)}
                        className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${activeTask === 2
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Task 2 — Essay
                    </button>
                </div>

                {/* Task Evaluation */}
                {activeTask === 1 ? (
                    <TaskEvaluation
                        key="task1"
                        title="Task 1: Academic Report"
                        taskNumber={1}
                        evaluation={data.task1}
                    />
                ) : (
                    <TaskEvaluation
                        key="task2"
                        title="Task 2: Essay"
                        taskNumber={2}
                        evaluation={data.task2}
                    />
                )}

                {/* Actions */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="flex gap-3 mt-8 pt-6 border-t border-border"
                >
                    <Button
                        variant="outline"
                        onClick={() => router.push("/dashboard")}
                        className="flex-1"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Home
                    </Button>
                    <Button
                        onClick={() => {
                            // Clear the standalone writing result
                            localStorage.removeItem("writingResult");
                            // Also clear the writing result from the persisted test results
                            try {
                                const stored = localStorage.getItem("ielts-test-results");
                                if (stored) {
                                    const results = JSON.parse(stored);
                                    const filtered = results.filter((r: { module: string }) => r.module !== "writing");
                                    localStorage.setItem("ielts-test-results", JSON.stringify(filtered));
                                }
                            } catch {
                                // Ignore errors
                            }
                            router.push("/dashboard");
                        }}
                        className="flex-1"
                    >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Try Again
                    </Button>
                </motion.div>

                {/* Footer */}
                <p className="text-center text-xs text-muted-foreground mt-6">
                    Evaluated using {data.task1.model_used || "AI"} • {new Date(data.timestamp).toLocaleDateString()}
                </p>
            </div>
        </div>
    );
}
