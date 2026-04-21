import 'server-only';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { ModuleBandBreakdown } from '@/lib/testing/types';

const TEMPLATE_DIRECTORY = path.join(process.cwd(), 'public', 'certificates', 'template');
const PREFERRED_TEMPLATE_FILES = [
  'certificate-background.png',
  'certificate-background.jpg',
  'certificate-background.jpeg',
  'certificate-background.webp',
  'certificate-background.avif',
];

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif']);
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let cachedTemplatePublicPath: string | null | undefined;

export type CertificatePreviewPayload = {
  certificateId: string;
  fullName: string;
  registerNumber: string;
  moduleBands: Partial<ModuleBandBreakdown> | null | undefined;
  overallBand: number;
  issuedAt: Date | string | null;
  verificationUrl: string;
};

type RenderOptions = {
  title?: string;
  badgeText?: string;
  templatePublicPath?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sanitizeTemplatePath(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith('/')) {
    return null;
  }

  if (/[<>`\"]/g.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function normalizeText(value: string | null | undefined, fallback: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeBand(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(9, value));
}

function normalizeModuleBands(value: Partial<ModuleBandBreakdown> | null | undefined): ModuleBandBreakdown {
  const source = value ?? {};

  return {
    listening: normalizeBand(source.listening),
    reading: normalizeBand(source.reading),
    writing: normalizeBand(source.writing),
    speaking: normalizeBand(source.speaking),
  };
}

function formatBand(value: number): string {
  return normalizeBand(value).toFixed(1);
}

function normalizeDate(value: Date | string | null): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function formatIssuedDate(value: Date | string | null): string {
  const date = normalizeDate(value);
  if (!date) {
    return '--';
  }

  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = MONTH_NAMES[date.getUTCMonth()] ?? '---';
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function toTemplatePublicPath(fileName: string): string {
  return `/certificates/template/${encodeURIComponent(fileName)}`;
}

function findTemplateFileName(): string | null {
  for (const preferredFileName of PREFERRED_TEMPLATE_FILES) {
    const absoluteCandidate = path.join(TEMPLATE_DIRECTORY, preferredFileName);
    if (existsSync(absoluteCandidate)) {
      return preferredFileName;
    }
  }

  const files = readdirSync(TEMPLATE_DIRECTORY, { withFileTypes: true });
  const imageFileNames = files
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((fileName) => IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
    .sort((left, right) => left.localeCompare(right));

  return imageFileNames[0] ?? null;
}

export function getCertificateTemplatePublicPath(): string | null {
  if (cachedTemplatePublicPath !== undefined) {
    return cachedTemplatePublicPath;
  }

  try {
    const templateFileName = findTemplateFileName();
    cachedTemplatePublicPath = templateFileName ? toTemplatePublicPath(templateFileName) : null;
  } catch {
    cachedTemplatePublicPath = null;
  }

  return cachedTemplatePublicPath;
}

export function renderCertificatePreviewHtml(
  payload: CertificatePreviewPayload,
  options: RenderOptions = {},
): string {
  const moduleBands = normalizeModuleBands(payload.moduleBands);
  const templatePath = sanitizeTemplatePath(options.templatePublicPath) ?? getCertificateTemplatePublicPath();

  const title = normalizeText(options.title, 'IELTS Certificate Preview');
  const badgeText = normalizeText(options.badgeText, '');

  const fullName = normalizeText(payload.fullName, 'Candidate Name');
  const registerNumber = normalizeText(payload.registerNumber, 'N/A');
  const certificateId = normalizeText(payload.certificateId, 'N/A');
  const verificationUrl = normalizeText(payload.verificationUrl, 'N/A');
  const issuedDate = formatIssuedDate(payload.issuedAt);
  const overallBand = formatBand(payload.overallBand);

  const listeningBand = formatBand(moduleBands.listening);
  const readingBand = formatBand(moduleBands.reading);
  const writingBand = formatBand(moduleBands.writing);
  const speakingBand = formatBand(moduleBands.speaking);

  const hasTemplateImage = typeof templatePath === 'string' && templatePath.length > 0;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: #f3eee4;
        padding: 24px;
        display: grid;
        place-items: center;
      }

      .page {
        width: min(1200px, 96vw);
      }

      .certificate {
        position: relative;
        width: 100%;
        aspect-ratio: 3508 / 2480;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 24px 70px rgba(38, 28, 8, 0.25);
        background: #f3eee4;
      }

      .template {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .template-fallback {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(255, 253, 248, 0.94), rgba(236, 222, 193, 0.92));
      }

      .name {
        position: absolute;
        left: 50%;
        top: 48%;
        transform: translate(-50%, -50%);
        width: 80%;
        text-align: center;
        font-size: clamp(1.2rem, 3.15vw, 3rem);
        font-weight: 700;
        letter-spacing: 0.02em;
        color: #352410;
        text-shadow: 0 2px 6px rgba(255, 255, 255, 0.45);
      }

      .score {
        position: absolute;
        font-size: clamp(0.95rem, 1.4vw, 1.5rem);
        font-weight: 700;
        color: #352410;
        text-shadow: 0 2px 4px rgba(255, 255, 255, 0.35);
      }

      .score-overall {
        left: 40.3%;
        top: 74.2%;
        transform: translateY(-50%);
      }

      .score-listening {
        left: 25.9%;
        top: 79.9%;
        transform: translateY(-50%);
      }

      .score-reading {
        left: 39.9%;
        top: 79.9%;
        transform: translateY(-50%);
      }

      .score-writing {
        left: 25.5%;
        top: 84.8%;
        transform: translateY(-50%);
      }

      .score-speaking {
        left: 39.9%;
        top: 84.8%;
        transform: translateY(-50%);
      }

      .metadata {
        display: none;
      }

      .template-note {
        margin: 12px 0 0;
        text-align: center;
        color: rgba(31, 26, 20, 0.75);
        font-size: 0.9rem;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="certificate" role="img" aria-label="IELTS certificate preview">
        ${hasTemplateImage ? `<img class="template" src="${escapeHtml(templatePath)}" alt="Certificate background template" />` : '<div class="template-fallback" aria-hidden="true"></div>'}

        <p class="name">${escapeHtml(fullName)}</p>

        <div class="score score-overall">${escapeHtml(overallBand)}</div>
        <div class="score score-listening">${escapeHtml(listeningBand)}</div>
        <div class="score score-reading">${escapeHtml(readingBand)}</div>
        <div class="score score-writing">${escapeHtml(writingBand)}</div>
        <div class="score score-speaking">${escapeHtml(speakingBand)}</div>

        <div class="metadata">
          <span>${escapeHtml(badgeText)}</span>
          <span>${escapeHtml(certificateId)}</span>
          <span>${escapeHtml(registerNumber)}</span>
          <span>${escapeHtml(issuedDate)}</span>
          <span>${escapeHtml(verificationUrl)}</span>
        </div>
      </section>
      ${hasTemplateImage ? '' : '<p class="template-note">Template image not found in public/certificates/template. Add certificate-background.png for final alignment.</p>'}
    </main>
  </body>
</html>`;
}