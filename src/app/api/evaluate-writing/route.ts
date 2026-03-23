import { NextResponse } from "next/server";

interface EvaluateWritingBody {
    taskType: string;
    essay: string;
    wordCount?: number;
    taskText?: string;
}

type VocabularyExplanation = {
    word: string;
    meaning: string;
    usage: string;
};

interface WritingEvaluation {
    overview: {
        overview: string;
        strengths: string[];
        weaknesses: string[];
    };
    scoring: {
        taskResponseHighLevel: string;
        taskResponseStrengths: string[];
        taskResponseWeaknesses: string[];
        coherenceHighLevel: string;
        coherenceStrengths: string[];
        coherenceWeaknesses: string[];
        taskResponseScore: number;
        coherenceScore: number;
    };
    languageAnalysis: {
        correctedEssay: string;
        keyChanges: string[];
        lexicalResourceHighLevel: string;
        lexicalResourceStrengths: string[];
        lexicalResourceWeaknesses: string[];
        grammaticalRangeHighLevel: string;
        grammaticalRangeStrengths: string[];
        grammaticalRangeWeaknesses: string[];
        lexicalResourceScore: number;
        grammaticalRangeScore: number;
    };
    improvement: {
        improvedEssay: string;
        vocabularyExplanations: VocabularyExplanation[];
        expandIdeas: string[];
        alternativeDirection: string;
        alternativeEssay: string;
        alternativeVocabulary: VocabularyExplanation[];
    };
}

interface EvaluateWritingResponse extends WritingEvaluation {
    evaluation_mode: "ai" | "fallback";
    model_used: string;
    warning?: string;
    overall_band: number;
    word_count: number;
}

interface NvidiaChatResponseEnvelope {
    choices?: Array<{ message?: { content?: string } }>;
}

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const PRIMARY_EVAL_MODEL = process.env.NVIDIA_MODEL ?? "stepfun-ai/step-3.5-flash";
const FALLBACK_EVAL_MODEL = process.env.NVIDIA_FALLBACK_MODEL ?? "microsoft/phi-4-mini-flash-reasoning";

const SYSTEM_PROMPT = `SYSTEM PROMPT

You are an IELTS Writing evaluation engine for Task 1 and Task 2.
Evaluate fairly using IELTS standards and simple student-friendly language.

Input variables:
- taskType: string (e.g., "Task 1 (Academic - describe a graph)" or "Task 2 (Essay)")
- essay: student essay text
- wordCount: integer

Core principles:
- Be accurate, practical, and encouraging.
- Do not invent weaknesses for balance.
- If there are no meaningful weaknesses for a criterion, return [] for that weakness list.
- Formal tone is acceptable in IELTS writing.
- Small repetition is acceptable unless clearly unnatural.
- American and British English are both acceptable if consistent.
- Assess communication quality, not literary brilliance.
- Keep feedback concise but useful.

Hard output rules:
- Return ONLY valid JSON.
- No markdown, no extra text.
- All arrays must always be arrays.
- Scores must be whole integers from 0 to 9.
- Use \n\n paragraph breaks in rewritten essays.

JSON schema to output:

{
    "overview": {
        "overview": "1-2 sentence overall comment without mentioning band score",
        "strengths": ["..."],
        "weaknesses": ["..."]
    },
    "scoring": {
        "taskResponseHighLevel": "1-2 sentence summary",
        "taskResponseStrengths": ["..."],
        "taskResponseWeaknesses": ["..."],
        "coherenceHighLevel": "1-2 sentence summary",
        "coherenceStrengths": ["..."],
        "coherenceWeaknesses": ["..."],
        "taskResponseScore": 0,
        "coherenceScore": 0
    },
    "languageAnalysis": {
        "correctedEssay": "Full essay with only genuine grammar/spelling/punctuation/word-form fixes",
        "keyChanges": ["Most important corrections with concrete examples"],
        "lexicalResourceHighLevel": "1-2 sentence summary",
        "lexicalResourceStrengths": ["..."],
        "lexicalResourceWeaknesses": ["..."],
        "grammaticalRangeHighLevel": "1-2 sentence summary",
        "grammaticalRangeStrengths": ["..."],
        "grammaticalRangeWeaknesses": ["..."],
        "lexicalResourceScore": 0,
        "grammaticalRangeScore": 0
    },
    "improvement": {
        "improvedEssay": "Band 8-9 rewrite",
        "vocabularyExplanations": [
            { "word": "...", "meaning": "...", "usage": "..." }
        ],
        "expandIdeas": ["..."],
        "alternativeDirection": "...",
        "alternativeEssay": "...",
        "alternativeVocabulary": [
            { "word": "...", "meaning": "...", "usage": "..." }
        ]
    }
}

Task detection:
- If taskType contains "Task 1", evaluate as Task 1 (Task Achievement focus).
- Otherwise evaluate as Task 2 (Task Response focus).

Task-specific logic:

Task 1:
- Focus on overview clarity, key feature reporting, comparisons/trends, and objective tone.
- No personal opinion needed.
- No conclusion required.
- In improvement:
    - Keep improvedEssay and vocabularyExplanations.
    - Set expandIdeas to [].
    - Set alternativeDirection to "".
    - Set alternativeEssay to "".
    - Set alternativeVocabulary to [].

Task 2:
- Focus on position clarity, full coverage, depth of development, and relevance.
- In improvement:
    - expandIdeas: 2-3 concrete ways to deepen existing arguments.
    - alternativeDirection: 2-3 sentences with a different approach.
    - alternativeEssay: full alternative essay from a different perspective.
    - alternativeVocabulary: vocabulary from alternativeEssay, preferably new to student wording.
- Do not require statistics/numerical evidence as mandatory.

Criterion boundaries:
- Task Response / Task Achievement: only task fulfillment.
- Coherence & Cohesion: only organization, progression, paragraphing, linking.
- Lexical Resource: only vocabulary, collocation, spelling, word formation.
- Grammatical Range & Accuracy: only structure variety, grammar correctness, punctuation control.

Correction stage rules:
- correctedEssay must preserve original ideas and structure.
- Fix only real grammar/spelling/punctuation/word-form errors.
- Do not stylistically rewrite correctedEssay.
- If mixed US/UK spelling is inconsistent, standardize to the dominant variety.

Scoring quality control:
- Keep scores consistent with IELTS descriptors.
- Avoid inflated and overly harsh marking.
- Ensure strengths/weaknesses align with scores.
- If underlength (especially far below expected IELTS length), reduce taskResponseScore appropriately and explain briefly.`;

function wordCount(text: string): number {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function estimateBandFromWordCount(count: number, taskType: string): number {
    const isTask1 = /task\s*1/i.test(taskType);
    const target = isTask1 ? 150 : 250;

    if (count >= target + 80) return 7;
    if (count >= target) return 6;
    if (count >= Math.floor(target * 0.7)) return 5;
    return 4;
}

function normalizeText(value: unknown): string {
    return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
}

function extractJsonObject(raw: string): string {
    const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fencedMatch?.[1]?.trim() ?? raw.trim();
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        return candidate;
    }

    return candidate.slice(firstBrace, lastBrace + 1);
}

function normalizeArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map(item => normalizeText(item)).filter(Boolean) : [];
}

function normalizeScore(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }

    return Math.max(0, Math.min(9, Math.round(value)));
}

function normalizeVocabulary(value: unknown): VocabularyExplanation[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map(item => {
            if (!item || typeof item !== "object") {
                return null;
            }

            const candidate = item as Partial<VocabularyExplanation>;
            return {
                word: normalizeText(candidate.word),
                meaning: normalizeText(candidate.meaning),
                usage: normalizeText(candidate.usage),
            };
        })
        .filter((item): item is VocabularyExplanation => Boolean(item && (item.word || item.meaning || item.usage)));
}

function normalizeEvaluation(parsed: unknown, taskType: string, essay: string): WritingEvaluation {
    const source = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    const overview = source.overview && typeof source.overview === "object"
        ? (source.overview as Record<string, unknown>)
        : {};
    const scoring = source.scoring && typeof source.scoring === "object"
        ? (source.scoring as Record<string, unknown>)
        : {};
    const languageAnalysis = source.languageAnalysis && typeof source.languageAnalysis === "object"
        ? (source.languageAnalysis as Record<string, unknown>)
        : {};
    const improvement = source.improvement && typeof source.improvement === "object"
        ? (source.improvement as Record<string, unknown>)
        : {};

    const isTask1 = /task\s*1/i.test(taskType);

    return {
        overview: {
            overview: normalizeText(overview.overview),
            strengths: normalizeArray(overview.strengths),
            weaknesses: normalizeArray(overview.weaknesses),
        },
        scoring: {
            taskResponseHighLevel: normalizeText(scoring.taskResponseHighLevel),
            taskResponseStrengths: normalizeArray(scoring.taskResponseStrengths),
            taskResponseWeaknesses: normalizeArray(scoring.taskResponseWeaknesses),
            coherenceHighLevel: normalizeText(scoring.coherenceHighLevel),
            coherenceStrengths: normalizeArray(scoring.coherenceStrengths),
            coherenceWeaknesses: normalizeArray(scoring.coherenceWeaknesses),
            taskResponseScore: normalizeScore(scoring.taskResponseScore),
            coherenceScore: normalizeScore(scoring.coherenceScore),
        },
        languageAnalysis: {
            correctedEssay: normalizeText(languageAnalysis.correctedEssay) || essay,
            keyChanges: normalizeArray(languageAnalysis.keyChanges),
            lexicalResourceHighLevel: normalizeText(languageAnalysis.lexicalResourceHighLevel),
            lexicalResourceStrengths: normalizeArray(languageAnalysis.lexicalResourceStrengths),
            lexicalResourceWeaknesses: normalizeArray(languageAnalysis.lexicalResourceWeaknesses),
            grammaticalRangeHighLevel: normalizeText(languageAnalysis.grammaticalRangeHighLevel),
            grammaticalRangeStrengths: normalizeArray(languageAnalysis.grammaticalRangeStrengths),
            grammaticalRangeWeaknesses: normalizeArray(languageAnalysis.grammaticalRangeWeaknesses),
            lexicalResourceScore: normalizeScore(languageAnalysis.lexicalResourceScore),
            grammaticalRangeScore: normalizeScore(languageAnalysis.grammaticalRangeScore),
        },
        improvement: {
            improvedEssay: normalizeText(improvement.improvedEssay),
            vocabularyExplanations: normalizeVocabulary(improvement.vocabularyExplanations),
            expandIdeas: isTask1 ? [] : normalizeArray(improvement.expandIdeas),
            alternativeDirection: isTask1 ? "" : normalizeText(improvement.alternativeDirection),
            alternativeEssay: isTask1 ? "" : normalizeText(improvement.alternativeEssay),
            alternativeVocabulary: isTask1 ? [] : normalizeVocabulary(improvement.alternativeVocabulary),
        },
    };
}

function calculateOverallBand(evaluation: WritingEvaluation): number {
    const avg = (
        evaluation.scoring.taskResponseScore +
        evaluation.scoring.coherenceScore +
        evaluation.languageAnalysis.lexicalResourceScore +
        evaluation.languageAnalysis.grammaticalRangeScore
    ) / 4;

    return Math.round(avg * 2) / 2;
}

function buildFallbackEvaluation(taskType: string, essay: string, count: number, reason: string): EvaluateWritingResponse {
    const score = estimateBandFromWordCount(count, taskType);
    const isTask1 = /task\s*1/i.test(taskType);
    const base: WritingEvaluation = {
        overview: {
            overview: "Automatic backup evaluation was used because live AI marking was unavailable.",
            strengths: count >= (isTask1 ? 150 : 250)
                ? ["Your response is close to the expected IELTS length."]
                : ["You attempted both task response and structure."],
            weaknesses: count < (isTask1 ? 150 : 250)
                ? ["The response is under the recommended word count, which limits task development."]
                : ["Add deeper support for key ideas to strengthen task fulfillment."],
        },
        scoring: {
            taskResponseHighLevel: "Task completion is estimated from response length and basic structure signals.",
            taskResponseStrengths: ["Main topic is present."],
            taskResponseWeaknesses: count < (isTask1 ? 150 : 250)
                ? ["Increase length and development to cover the task more fully."]
                : ["Support key points with clearer explanations and examples."],
            coherenceHighLevel: "Organization appears partially clear but needs smoother progression.",
            coherenceStrengths: ["The response is segmented into readable parts."],
            coherenceWeaknesses: ["Use clearer linking and paragraph focus."],
            taskResponseScore: score,
            coherenceScore: score,
        },
        languageAnalysis: {
            correctedEssay: essay,
            keyChanges: [],
            lexicalResourceHighLevel: "Vocabulary range appears moderate in this fallback estimate.",
            lexicalResourceStrengths: ["Some topic-related words are used."],
            lexicalResourceWeaknesses: ["Use more precise collocations and reduce repetition."],
            grammaticalRangeHighLevel: "Sentence control appears mixed in this fallback estimate.",
            grammaticalRangeStrengths: ["Basic sentence control is present."],
            grammaticalRangeWeaknesses: ["Increase grammatical variety and check punctuation."],
            lexicalResourceScore: score,
            grammaticalRangeScore: score,
        },
        improvement: {
            improvedEssay: "",
            vocabularyExplanations: [],
            expandIdeas: isTask1
                ? []
                : [
                    "Develop each paragraph with one clear claim, explanation, and example.",
                    "Make your position explicit in the introduction and reinforce it in each body paragraph.",
                ],
            alternativeDirection: isTask1 ? "" : "Consider a balanced approach that addresses both benefits and drawbacks before concluding with your final stance.",
            alternativeEssay: "",
            alternativeVocabulary: [],
        },
    };

    return {
        ...base,
        evaluation_mode: "fallback",
        model_used: "word-count-fallback",
        warning: reason,
        overall_band: calculateOverallBand(base),
        word_count: count,
    };
}

async function evaluateWithModel(apiKey: string, model: string, taskType: string, essay: string, count: number): Promise<WritingEvaluation> {
    const response = await fetch(NVIDIA_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                    role: "user",
                    content: `Now evaluate using:\ntaskType: ${taskType}\nessay: ${essay}\nwordCount: ${count}`,
                },
            ],
            temperature: 0.1,
            top_p: 0.9,
            max_tokens: 3500,
            stream: false,
        }),
    });

    if (!response.ok) {
        throw new Error(`Nvidia API error: ${await response.text()}`);
    }

    const data = (await response.json()) as NvidiaChatResponseEnvelope;
    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
        throw new Error("Invalid Nvidia response format");
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(extractJsonObject(content));
    } catch {
        throw new Error("Failed to parse AI response as JSON");
    }

    return normalizeEvaluation(parsed, taskType, essay);
}

export async function POST(req: Request) {
    const apiKey = process.env.NVIDIA_API_KEY;

    let body: EvaluateWritingBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const taskType = typeof body.taskType === "string" ? body.taskType : "";
    const essay = typeof body.essay === "string"
        ? body.essay
        : (typeof body.taskText === "string" ? body.taskText : "");

    if (!essay || !taskType) {
        return NextResponse.json({ error: "essay and taskType are required" }, { status: 400 });
    }

    const count = typeof body.wordCount === "number" && Number.isFinite(body.wordCount)
        ? Math.max(0, Math.round(body.wordCount))
        : wordCount(essay);

    if (!apiKey) {
        return NextResponse.json(buildFallbackEvaluation(taskType, essay, count, "Missing NVIDIA_API_KEY"));
    }

    let lastError = "AI evaluation failed";
    for (const model of [PRIMARY_EVAL_MODEL, FALLBACK_EVAL_MODEL]) {
        try {
            const evaluation = await evaluateWithModel(apiKey, model, taskType, essay, count);
            return NextResponse.json({
                ...evaluation,
                evaluation_mode: "ai",
                model_used: model,
                overall_band: calculateOverallBand(evaluation),
                word_count: count,
            } satisfies EvaluateWritingResponse);
        } catch (error) {
            lastError = error instanceof Error ? error.message : "Nvidia request failed";
        }
    }

    return NextResponse.json(buildFallbackEvaluation(taskType, essay, count, lastError));
}
