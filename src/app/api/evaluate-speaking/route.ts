import { NextResponse } from "next/server";
import type { CriterionScore, SpeakingEvaluationApiResponse } from "@/lib/ielts-types";

interface EvaluateSpeakingBody {
    fullTranscript: string;
}

interface NvidiaChatResponseEnvelope {
    choices?: Array<{ message?: { content?: string } }>;
}

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_SPEAKING_MODEL = process.env.NVIDIA_SPEAKING_MODEL
    ?? process.env.NVIDIA_READING_MODEL
    ?? "moonshotai/kimi-k2-instruct-0905";
const NVIDIA_FALLBACK_MODEL = process.env.NVIDIA_FALLBACK_MODEL ?? "microsoft/phi-4-mini-flash-reasoning";

const SYSTEM_PROMPT = `You are a certified IELTS Speaking examiner.
Evaluate the transcript according to official IELTS Speaking Band Descriptors.

Return ONLY valid JSON with this schema:
{
  "fluency_coherence": { "band": 0.0, "feedback": "", "examples": [""] },
  "lexical_resource": { "band": 0.0, "feedback": "", "examples": [""] },
  "grammatical_range": { "band": 0.0, "feedback": "", "examples": [""] },
  "pronunciation": { "band": 0.0, "feedback": "", "examples": [""], "inferred_from": "" },
  "overall_band": 0.0,
  "strengths": [""],
  "improvements": [""],
  "examiner_comment": ""
}`;

function getWordCount(text: string): number {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
}

function normalizeText(value: unknown): string {
    return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
}

function normalizeArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.map(item => normalizeText(item)).filter(Boolean);
}

function clampBand(value: unknown): number {
    const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
    const clamped = Math.max(0, Math.min(9, numeric));
    return Math.round(clamped * 2) / 2;
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

function normalizeCriterion(value: unknown, fallbackFeedback: string): CriterionScore {
    const source = value && typeof value === "object" ? value as Record<string, unknown> : {};

    return {
        band: clampBand(source.band),
        feedback: normalizeText(source.feedback) || fallbackFeedback,
        examples: normalizeArray(source.examples),
    };
}

function buildFallbackEvaluation(fullTranscript: string, reason: string): SpeakingEvaluationApiResponse {
    const wordCount = getWordCount(fullTranscript);
    const estimatedBand = wordCount >= 200 ? 6.0 : wordCount >= 100 ? 5.0 : 4.0;

    const genericCriterion: CriterionScore = {
        band: estimatedBand,
        feedback: "Fallback estimate based on transcript length and basic fluency signals.",
        examples: [],
    };

    return {
        fluency_coherence: genericCriterion,
        lexical_resource: {
            ...genericCriterion,
            feedback: "Vocabulary range is estimated in fallback mode and may differ from examiner-level scoring.",
        },
        grammatical_range: {
            ...genericCriterion,
            feedback: "Grammar score is estimated in fallback mode from transcript quality cues.",
        },
        pronunciation: {
            ...genericCriterion,
            feedback: "Pronunciation is inferred from transcript text only in fallback mode.",
            inferred_from: "Transcript-only evaluation. Audio pronunciation was not analyzed.",
        },
        overall_band: estimatedBand,
        strengths: wordCount >= 150
            ? ["Response length supports clearer idea development."]
            : ["You attempted to answer the speaking prompts."],
        improvements: wordCount < 150
            ? ["Speak at greater length and add more supporting details."]
            : ["Use a wider range of vocabulary and complex sentence forms."],
        examiner_comment: "AI speaking evaluation was unavailable, so a fallback estimate was used.",
        evaluation_mode: "fallback",
        model_used: "word-count-fallback",
        warning: reason,
        word_count: wordCount,
    };
}

function normalizeEvaluation(parsed: unknown, transcript: string, modelUsed: string): SpeakingEvaluationApiResponse {
    const source = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};

    const fluency = normalizeCriterion(source.fluency_coherence, "Fluency and coherence require further development.");
    const lexical = normalizeCriterion(source.lexical_resource, "Lexical range is adequate but can be expanded.");
    const grammar = normalizeCriterion(source.grammatical_range, "Grammar control is mixed and needs refinement.");
    const pronunciationBase = normalizeCriterion(source.pronunciation, "Pronunciation feedback is inferred from transcript evidence.");

    const pronunciationSource = source.pronunciation && typeof source.pronunciation === "object"
        ? source.pronunciation as Record<string, unknown>
        : {};
    const inferredFrom = normalizeText(pronunciationSource.inferred_from)
        || pronunciationBase.examples[0]
        || "Transcript-only evaluation. Audio pronunciation was not analyzed.";

    const computedBand = (fluency.band + lexical.band + grammar.band + pronunciationBase.band) / 4;

    return {
        fluency_coherence: fluency,
        lexical_resource: lexical,
        grammatical_range: grammar,
        pronunciation: {
            ...pronunciationBase,
            inferred_from: inferredFrom,
        },
        overall_band: clampBand(source.overall_band || computedBand),
        strengths: normalizeArray(source.strengths),
        improvements: normalizeArray(source.improvements),
        examiner_comment: normalizeText(source.examiner_comment),
        evaluation_mode: "ai",
        model_used: modelUsed,
        word_count: getWordCount(transcript),
    };
}

function buildModelChain(models: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];

    models.forEach(model => {
        const normalized = model.trim();
        if (!normalized || seen.has(normalized)) {
            return;
        }

        seen.add(normalized);
        output.push(normalized);
    });

    return output;
}

async function callNvidia(apiKey: string, model: string, transcript: string): Promise<string> {
    const response = await fetch(NVIDIA_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            max_tokens: 1200,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: transcript },
            ],
            temperature: 0.1,
            top_p: 0.9,
            stream: false,
        }),
    });

    if (!response.ok) {
        const details = await response.text();
        throw new Error(`Nvidia API error: ${details.slice(0, 500)}`);
    }

    const data = await response.json() as NvidiaChatResponseEnvelope;
    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
        throw new Error("Invalid Nvidia response format");
    }

    return content;
}

export async function POST(req: Request) {
    let body: EvaluateSpeakingBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const fullTranscript = normalizeText(body.fullTranscript);
    if (!fullTranscript) {
        return NextResponse.json({ error: "fullTranscript is required" }, { status: 400 });
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
        return NextResponse.json(
            buildFallbackEvaluation(fullTranscript, "Missing NVIDIA_API_KEY"),
        );
    }

    let lastError = "Speaking evaluation failed";
    const modelChain = buildModelChain([NVIDIA_SPEAKING_MODEL, NVIDIA_FALLBACK_MODEL]);

    for (const model of modelChain) {
        try {
            const rawResponse = await callNvidia(apiKey, model, fullTranscript);
            const parsed = JSON.parse(extractJsonObject(rawResponse));
            const normalized = normalizeEvaluation(parsed, fullTranscript, model);
            return NextResponse.json(normalized);
        } catch (error) {
            lastError = error instanceof Error ? error.message : "Nvidia request failed";
        }
    }

    return NextResponse.json(buildFallbackEvaluation(fullTranscript, lastError));
}
