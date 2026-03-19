import { NextResponse } from "next/server";

interface EvaluateSpeakingBody {
  fullTranscript: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  let body: EvaluateSpeakingBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!body.fullTranscript) {
    return NextResponse.json({ error: "fullTranscript is required" }, { status: 400 });
  }

  const systemPrompt = `You are a certified IELTS Speaking examiner. Evaluate the transcript according to official IELTS Speaking Band Descriptors.

RETURN STRICTLY THIS JSON:
{
  "fluency_coherence": { "band": 0.0, "feedback": "", "examples": [] },
  "lexical_resource": { "band": 0.0, "feedback": "", "examples": [] },
  "grammatical_range": { "band": 0.0, "feedback": "", "examples": [] },
  "pronunciation": { "band": 0.0, "feedback": "", "inferred_from": "" },
  "overall_band": 0.0,
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
      messages: [{ role: "user", content: body.fullTranscript }],
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
