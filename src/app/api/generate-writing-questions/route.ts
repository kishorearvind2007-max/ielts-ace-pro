import { NextResponse } from 'next/server';
import { generateWritingQuestions } from '@/lib/nvidia-api';

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const difficulty = searchParams.get('difficulty') ?? 'Band 6';

  try {
    const questions = await generateWritingQuestions(difficulty);
    return NextResponse.json(questions);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate questions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
