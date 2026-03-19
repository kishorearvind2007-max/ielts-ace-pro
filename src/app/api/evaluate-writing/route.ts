import { NextResponse } from "next/server";

interface EvaluateWritingBody {
    taskText: string;
    taskType: string;
}

export async function POST(req: Request) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
    }

    let body: EvaluateWritingBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    if (!body.taskText || !body.taskType) {
        return NextResponse.json({ error: "taskText and taskType are required" }, { status: 400 });
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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
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

    if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: "Anthropic API error", details: errorText }, { status: 502 });
    }

    const data = await response.json();
    const content = data?.content?.[0]?.text;

    if (!content || typeof content !== "string") {
        return NextResponse.json({ error: "Invalid Anthropic response format" }, { status: 502 });
    }

    try {
        const parsed = JSON.parse(content);
        return NextResponse.json(parsed);
    } catch {
        return NextResponse.json({ error: "Failed to parse AI response as JSON" }, { status: 502 });
    }
}
