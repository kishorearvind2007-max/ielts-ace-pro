import { NextResponse } from 'next/server';
import { speakingContent } from '@/data/ielts-content';
import { generateSpeakingQuestions } from '@/lib/nvidia-api';

function getFallbackSpeakingQuestions() {
  return {
    parts: speakingContent,
    source: 'fallback',
    model_used: 'fallback',
  };
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const difficulty = searchParams.get('difficulty') ?? 'Band 6';

  try {
    const generated = await generateSpeakingQuestions(difficulty);
    return NextResponse.json({
      parts: generated.parts,
      source: 'nvidia',
      model_used: generated.modelUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate speaking content';
    const fallback = getFallbackSpeakingQuestions();
    return NextResponse.json({ ...fallback, warning: message });
  }
}