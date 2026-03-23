import { NextResponse } from "next/server";

interface EvaluateWritingBody {
    taskText: string;
    taskType: string;
}

interface WritingEvaluation {
    task_achievement: { band: number; feedback: string; examples: string[] };
    coherence_cohesion: { band: number; feedback: string; examples: string[] };
    lexical_resource: { band: number; feedback: string; examples: string[] };
    grammatical_range: { band: number; feedback: string; examples: string[] };
    overall_band: number;
    word_count: number;
    strengths: string[];
    improvements: string[];
    examiner_comment: string;
    evaluation_mode: "ai" | "fallback";
    warning?: string;
}

function wordCount(text: string): number {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function estimateBandFromWordCount(count: number, taskType: string): number {
    const isTask1 = /task\s*1/i.test(taskType);
    const target = isTask1 ? 150 : 250;

    if (count >= target + 80) return 7.0;
    if (count >= target) return 6.0;
    if (count >= Math.floor(target * 0.7)) return 5.0;
    return 4.0;
}

function buildFallbackEvaluation(taskText: string, taskType: string, reason: string): WritingEvaluation {
    const wc = wordCount(taskText);
    const band = estimateBandFromWordCount(wc, taskType);

    return {
        task_achievement: {
            band,
            feedback: wc < 120 ? "Response is too short to fully develop key ideas." : "Main response is present, but may need deeper development and clearer support.",
            examples: [],
        },
        coherence_cohesion: {
            band,
            feedback: "Improve paragraphing and use clearer linking between ideas.",
            examples: [],
        },
        lexical_resource: {
            band,
            feedback: "Use a wider range of topic-specific vocabulary and avoid repetition.",
            examples: [],
        },
        grammatical_range: {
            band,
            feedback: "Use a broader variety of sentence structures and proofread for errors.",
            examples: [],
        },
        overall_band: band,
        word_count: wc,
        strengths: wc >= 150 ? ["Sufficient response length for basic task coverage"] : ["Attempted a complete response"],
        improvements: [
            "Develop each main point with specific explanation or example",
            "Use clearer paragraph structure and transitions",
            "Review grammar and word choice before submission",
        ],
        examiner_comment: "Fallback scoring was used because live AI evaluation is currently unavailable.",
        evaluation_mode: "fallback",
        warning: reason,
    };
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

export async function POST(req: Request) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    let body: EvaluateWritingBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    if (!body.taskText || !body.taskType) {
        return NextResponse.json({ error: "taskText and taskType are required" }, { status: 400 });
    }

    if (!apiKey) {
        return NextResponse.json(buildFallbackEvaluation(body.taskText, body.taskType, "Missing ANTHROPIC_API_KEY"));
    }

    const systemPrompt = `You are a certified IELTS examiner with 10+ years of experience. Evaluate the following ${body.taskType} response strictly according to official IELTS Writing Band Descriptors.

RETURN STRICTLY THIS JSON (no extra text):
{
  "task_achievement": { "band": 0.0, "feedback": "", "examples": [] },
  "coherence_cohesion": { "band": 0.0, "feedback": "", "examples": [] },
  "lexical_resource": { "band": 0.0, "feedback": "", "examples": [] },
  "grammatical_range": { "band": 0.0, "feedback": "", "examples": [] },
  "overall_band": 0.0,
  "word_count": 0,
  "strengths": [],
  "improvements": [],
  "examiner_comment": ""
}`;

    let response: Response;
    try {
        response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
                max_tokens: 1000,
                system: systemPrompt,
                messages: [{ role: "user", content: body.taskText }],
            }),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Anthropic request failed";
        return NextResponse.json(buildFallbackEvaluation(body.taskText, body.taskType, message));
    }

    if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(buildFallbackEvaluation(body.taskText, body.taskType, `Anthropic API error: ${errorText}`));
    }

    const data = await response.json();
    const content = data?.content?.[0]?.text;

    if (!content || typeof content !== "string") {
        return NextResponse.json(buildFallbackEvaluation(body.taskText, body.taskType, "Invalid Anthropic response format"));
    }

    try {
        const parsed = JSON.parse(extractJsonObject(content)) as Partial<WritingEvaluation>;
        return NextResponse.json({
            ...parsed,
            evaluation_mode: "ai",
        });
    } catch {
        return NextResponse.json(buildFallbackEvaluation(body.taskText, body.taskType, "Failed to parse AI response as JSON"));
    }
}
