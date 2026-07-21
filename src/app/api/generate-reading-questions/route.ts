import { NextResponse } from 'next/server';
import { generateReadingPassages } from '@/lib/nvidia-api';
import { readingContent } from '@/data/ielts-content';

function getFallbackReadingQuestions() {
  return {
    passages: readingContent,
    source: 'fallback',
  };
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const difficulty = searchParams.get('difficulty') ?? 'Band 6';

  try {
    const generated = await generateReadingPassages(difficulty);
    return NextResponse.json({ ...generated, source: 'nvidia' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate reading content';
    const fallback = getFallbackReadingQuestions();
    return NextResponse.json({ ...fallback, warning: message });
  }
}
