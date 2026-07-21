import { NextResponse } from 'next/server';
import { listeningContent } from '@/data/ielts-content';
import { generateListeningSection } from '@/lib/nvidia-api';
import type { ListeningSection } from '@/lib/ielts-types';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type ListeningCacheEntry = {
  section: ListeningSection;
  modelUsed: string;
  expiresAt: number;
};

const listeningCache = new Map<string, ListeningCacheEntry>();

function buildCacheKey(sectionNumber: number, difficulty: string) {
  return `${sectionNumber}:${difficulty.trim().toLowerCase()}`;
}

function parseSectionNumber(raw: string | null): number {
  const parsed = Number(raw ?? '1');
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) {
    throw new Error('sectionNumber must be an integer between 1 and 4');
  }
  return parsed;
}

function getCachedSection(sectionNumber: number, difficulty: string): ListeningCacheEntry | null {
  const key = buildCacheKey(sectionNumber, difficulty);
  const existing = listeningCache.get(key);
  if (!existing) {
    return null;
  }

  if (Date.now() > existing.expiresAt) {
    listeningCache.delete(key);
    return null;
  }

  return existing;
}

function setCachedSection(sectionNumber: number, difficulty: string, entry: Omit<ListeningCacheEntry, 'expiresAt'>) {
  const key = buildCacheKey(sectionNumber, difficulty);
  listeningCache.set(key, {
    ...entry,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function getFallbackSection(sectionNumber: number): ListeningSection {
  const fallback = listeningContent.find(section => section.id === sectionNumber);
  if (!fallback) {
    throw new Error(`Missing fallback listening section ${sectionNumber}`);
  }

  return {
    ...fallback,
    source: 'fallback',
  };
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const difficulty = searchParams.get('difficulty') ?? 'Band 6';

  let sectionNumber = 1;
  try {
    sectionNumber = parseSectionNumber(searchParams.get('sectionNumber'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid sectionNumber';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const cached = getCachedSection(sectionNumber, difficulty);
  if (cached) {
    return NextResponse.json({
      section: { ...cached.section, source: 'nvidia' },
      source: 'nvidia',
      modelUsed: cached.modelUsed,
      cached: true,
    });
  }

  try {
    const { section, modelUsed } = await generateListeningSection(sectionNumber, difficulty);

    setCachedSection(sectionNumber, difficulty, {
      section,
      modelUsed,
    });

    return NextResponse.json({
      section: { ...section, source: 'nvidia' },
      source: 'nvidia',
      modelUsed,
      cached: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate listening section';
    const fallbackSection = getFallbackSection(sectionNumber);

    return NextResponse.json({
      section: fallbackSection,
      source: 'fallback',
      warning: message,
      cached: false,
    });
  }
}
