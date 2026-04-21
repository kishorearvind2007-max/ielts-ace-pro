import 'server-only';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
} from 'pdf-lib';
import {
  getCertificateTemplatePublicPath,
  type CertificatePreviewPayload,
} from '@/lib/testing/certificate-preview-renderer';
import type { ModuleBandBreakdown } from '@/lib/testing/types';

const TEMPLATE_PUBLIC_PREFIX = '/certificates/template/';
const DEFAULT_PAGE_WIDTH = 3508;
const DEFAULT_PAGE_HEIGHT = 2480;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type RenderCertificatePdfOptions = {
  templatePublicPath?: string | null;
};

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

function resolveTemplateAbsolutePath(templatePublicPath: string | null | undefined): string | null {
  if (typeof templatePublicPath !== 'string' || !templatePublicPath.startsWith(TEMPLATE_PUBLIC_PREFIX)) {
    return null;
  }

  const encodedFileName = templatePublicPath.slice(TEMPLATE_PUBLIC_PREFIX.length);
  if (!encodedFileName) {
    return null;
  }

  let decodedFileName = '';
  try {
    decodedFileName = decodeURIComponent(encodedFileName);
  } catch {
    return null;
  }

  if (!decodedFileName || decodedFileName.includes('..') || path.isAbsolute(decodedFileName)) {
    return null;
  }

  const absolutePath = path.join(process.cwd(), 'public', 'certificates', 'template', decodedFileName);
  if (!existsSync(absolutePath)) {
    return null;
  }

  return absolutePath;
}

async function loadTemplateImage(
  pdfDocument: PDFDocument,
  templatePublicPath: string | null,
): Promise<{ image: PDFImage; width: number; height: number } | null> {
  const absolutePath = resolveTemplateAbsolutePath(templatePublicPath);
  if (!absolutePath) {
    return null;
  }

  const extension = path.extname(absolutePath).toLowerCase();
  if (extension !== '.png' && extension !== '.jpg' && extension !== '.jpeg') {
    return null;
  }

  try {
    const bytes = await readFile(absolutePath);

    const image = extension === '.png'
      ? await pdfDocument.embedPng(bytes)
      : await pdfDocument.embedJpg(bytes);

    return {
      image,
      width: image.width,
      height: image.height,
    };
  } catch {
    return null;
  }
}

function fitTextSize(
  font: PDFFont,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
): number {
  let size = maxSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 1;
  }

  return Math.max(size, minSize);
}

function baselineFromTopPercent(topPercent: number, pageHeight: number, fontSize: number): number {
  return (pageHeight * (1 - topPercent)) - (fontSize * 0.34);
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  const leftLength = Math.ceil((maxLength - 3) / 2);
  const rightLength = Math.floor((maxLength - 3) / 2);
  return `${value.slice(0, leftLength)}...${value.slice(value.length - rightLength)}`;
}

export async function renderCertificatePdf(
  payload: CertificatePreviewPayload,
  options: RenderCertificatePdfOptions = {},
): Promise<Uint8Array> {
  const moduleBands = normalizeModuleBands(payload.moduleBands);
  const templatePath = options.templatePublicPath ?? getCertificateTemplatePublicPath();

  const pdfDocument = await PDFDocument.create();
  const templateImage = await loadTemplateImage(pdfDocument, templatePath);

  const pageWidth = templateImage?.width ?? DEFAULT_PAGE_WIDTH;
  const pageHeight = templateImage?.height ?? DEFAULT_PAGE_HEIGHT;
  const page = pdfDocument.addPage([pageWidth, pageHeight]);

  if (templateImage) {
    page.drawImage(templateImage.image, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });
  }

  const textColor = rgb(0x35 / 255, 0x24 / 255, 0x10 / 255);
  const boldFont = await pdfDocument.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDocument.embedFont(StandardFonts.Helvetica);

  const fullName = normalizeText(payload.fullName, 'Candidate Name');
  const registerNumber = normalizeText(payload.registerNumber, 'N/A');
  const certificateId = normalizeText(payload.certificateId, 'N/A');
  const issuedDate = formatIssuedDate(payload.issuedAt);
  const verificationUrl = normalizeText(payload.verificationUrl, 'N/A');

  const nameFontSize = fitTextSize(
    boldFont,
    fullName,
    pageWidth * 0.78,
    Math.max(56, pageWidth * 0.028),
    Math.max(36, pageWidth * 0.016),
  );

  const nameWidth = boldFont.widthOfTextAtSize(fullName, nameFontSize);
  page.drawText(fullName, {
    x: (pageWidth - nameWidth) / 2,
    y: baselineFromTopPercent(0.48, pageHeight, nameFontSize),
    size: nameFontSize,
    font: boldFont,
    color: textColor,
  });

  const scoreFontSize = Math.max(26, Math.min(62, pageWidth * 0.016));
  const drawScore = (value: string, leftPercent: number, topPercent: number) => {
    page.drawText(value, {
      x: pageWidth * leftPercent,
      y: baselineFromTopPercent(topPercent, pageHeight, scoreFontSize),
      size: scoreFontSize,
      font: boldFont,
      color: textColor,
    });
  };

  drawScore(formatBand(payload.overallBand), 0.403, 0.742);
  drawScore(formatBand(moduleBands.listening), 0.259, 0.799);
  drawScore(formatBand(moduleBands.reading), 0.399, 0.799);
  drawScore(formatBand(moduleBands.writing), 0.255, 0.848);
  drawScore(formatBand(moduleBands.speaking), 0.399, 0.848);

  const metadataFontSize = Math.max(18, Math.min(24, pageWidth * 0.006));
  const metadataX = pageWidth * 0.055;
  const metadataY = pageHeight * 0.062;
  const metadataWidth = pageWidth * 0.42;
  const metadataHeight = pageHeight * 0.14;

  page.drawRectangle({
    x: metadataX,
    y: metadataY,
    width: metadataWidth,
    height: metadataHeight,
    color: rgb(1, 1, 1),
    opacity: 0.74,
    borderColor: rgb(0.73, 0.62, 0.44),
    borderWidth: 1,
  });

  const metadataLines = [
    `Certificate ID: ${certificateId}`,
    `Register Number: ${registerNumber}`,
    `Issued On: ${issuedDate}`,
    `Verify: ${truncateText(verificationUrl, 72)}`,
  ];

  metadataLines.forEach((line, index) => {
    page.drawText(line, {
      x: metadataX + (pageWidth * 0.012),
      y: metadataY + metadataHeight - ((index + 1) * (metadataFontSize + 10)),
      size: metadataFontSize,
      font: regularFont,
      color: textColor,
    });
  });

  return pdfDocument.save();
}