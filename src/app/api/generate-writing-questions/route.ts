import { NextResponse } from 'next/server';
import { generateWritingQuestions } from '@/lib/nvidia-api';
import { writingContent } from '@/data/ielts-content';

function getFallbackWritingQuestions() {
  return {
    task1: writingContent.find(task => task.type === 'task1') ?? writingContent[0],
    task2: writingContent.find(task => task.type === 'task2') ?? writingContent[1],
    source: 'fallback',
    model_used: 'fallback',
  };
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const difficulty = searchParams.get('difficulty') ?? 'Band 6';

  try {
    const questions = await generateWritingQuestions(difficulty);
    return NextResponse.json({
      task1: questions.task1,
      task2: questions.task2,
      source: 'nvidia',
      model_used: questions.modelUsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate questions';
    const fallback = getFallbackWritingQuestions();
    return NextResponse.json({ ...fallback, warning: message });
  }
}
