import { NextRequest, NextResponse } from 'next/server';
import { generateListeningContent, getCacheKey, ContentType, DifficultyLevel } from '@/lib/listening-generator';

// In-memory cache for generated content (in production, use Redis/database)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Auto-map IELTS listening sections to content types
 * Section 1 (S1) → Conversation (2 speakers, everyday context)
 * Section 2 (S2) → Monologue (1 speaker, tour guide/announcement)
 * Section 3 (S3) → Academic (3-4 speakers, group discussion)
 * Section 4 (S4) → Lecture (1 speaker, academic lecture)
 */
function mapSectionToContentType(sectionNumber: number): ContentType {
  const mapping: Record<number, ContentType> = {
    1: 'conversation',
    2: 'monologue',
    3: 'academic',
    4: 'lecture',
  };
  return mapping[sectionNumber] || 'conversation';
}

/**
 * GET /api/generate-listening
 * Query params: sectionNumber (1-4), topic (optional), difficulty (optional)
 * Auto-maps section to content type
 * Returns: Generated listening section with script, questions, answerKey
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sectionNumber = parseInt(searchParams.get('sectionNumber') || '1', 10);
    const topic = searchParams.get('topic') || undefined;
    const difficulty = (searchParams.get('difficulty') || 'medium') as DifficultyLevel;

    // Validate section number
    if (sectionNumber < 1 || sectionNumber > 4) {
      return NextResponse.json({ error: 'sectionNumber must be 1-4' }, { status: 400 });
    }

    // Validate section number
    if (sectionNumber < 1 || sectionNumber > 4) {
      return NextResponse.json({ error: 'sectionNumber must be 1-4' }, { status: 400 });
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return NextResponse.json({ error: 'Invalid difficulty level' }, { status: 400 });
    }

    // Auto-map section number to content type
    const contentType = mapSectionToContentType(sectionNumber);

    // Check cache
    const cacheKey = getCacheKey({ contentType, topic, difficulty, sectionNumber });
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        cached: true,
        message: 'Content retrieved from cache',
      });
    }

    // Generate new content via Qwen LLM
    const generatedContent = await generateListeningContent({
      contentType,
      topic,
      difficulty,
      sectionNumber,
    });

    // Store in cache
    cache.set(cacheKey, {
      data: generatedContent,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      data: generatedContent,
      cached: false,
      message: 'Content generated successfully',
    });
  } catch (error) {
    console.error('[generate-listening] Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/generate-listening
 * Body: { sectionNumber, topic?, difficulty? }
 * Auto-maps section to content type
 * Returns: Generated listening section
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sectionNumber, topic, difficulty = 'medium' } = body;

    // Validate required fields
    if (!sectionNumber) {
      return NextResponse.json(
        { error: 'Missing required field: sectionNumber' },
        { status: 400 }
      );
    }

    if (sectionNumber < 1 || sectionNumber > 4) {
      return NextResponse.json({ error: 'sectionNumber must be 1-4' }, { status: 400 });
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return NextResponse.json({ error: 'Invalid difficulty level' }, { status: 400 });
    }

    // Auto-map section number to content type
    const contentType = mapSectionToContentType(sectionNumber);

    // Check cache
    const cacheKey = getCacheKey({ contentType, topic, difficulty, sectionNumber });
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        cached: true,
      });
    }

    // Generate via Qwen LLM
    const generatedContent = await generateListeningContent({
      contentType,
      topic,
      difficulty: difficulty as DifficultyLevel,
      sectionNumber,
    });

    // Cache result
    cache.set(cacheKey, {
      data: generatedContent,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      data: generatedContent,
      cached: false,
    });
  } catch (error) {
    console.error('[generate-listening POST] Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
