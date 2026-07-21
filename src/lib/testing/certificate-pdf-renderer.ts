import 'server-only';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
} from 'pdf-lib';
import QRCode from 'qrcode';
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

async function generateQRCodeDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 400,
      color: {
        dark: '#352410',
        light: '#FFFFFF',
      },
    });
  } catch {
    // Return a minimal fallback QR code data URL if generation fails
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }
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

  const fullName = normalizeText(payload.fullName, 'Candidate Name');
  const registerNumber = normalizeText(payload.registerNumber, 'N/A');
  const certificateId = normalizeText(payload.certificateId, 'N/A');
  const issuedDate = formatIssuedDate(payload.issuedAt);
  const verificationUrl = normalizeText(payload.verificationUrl, 'N/A');

  // Name positioning - exactly matching HTML preview
  // HTML: top: 48%, centered horizontally, font-size: clamp(1.2rem, 3.15vw, 3rem) ≈ 3.15% of width
  const nameFontSize = pageWidth * 0.0315; // 3.15% of page width for font size
  const nameWidth = boldFont.widthOfTextAtSize(fullName, nameFontSize);
  const nameX = (pageWidth - nameWidth) / 2; // Centered
  const nameY = pageHeight * 0.52; // 48% from top = 52% from bottom in PDF coordinates

  page.drawText(fullName, {
    x: nameX,
    y: nameY,
    size: nameFontSize,
    font: boldFont,
    color: textColor,
  });

  // Score positioning - exactly matching HTML preview
  // HTML: font-size: clamp(0.95rem, 1.4vw, 1.5rem) ≈ 1.4% of width
  const scoreFontSize = pageWidth * 0.014; // 1.4% of page width

  // Helper to place scores using exact HTML percentages
  const drawScore = (value: string, leftPercent: number, topPercent: number) => {
    const x = pageWidth * leftPercent;
    const y = pageHeight * (1 - topPercent); // Convert top % to bottom % for PDF
    
    page.drawText(value, {
      x,
      y,
      size: scoreFontSize,
      font: boldFont,
      color: textColor,
    });
  };

  // Exact positions from HTML CSS
  drawScore(formatBand(payload.overallBand), 0.403, 0.742);   // Overall
  drawScore(formatBand(moduleBands.listening), 0.259, 0.799); // Listening
  drawScore(formatBand(moduleBands.reading), 0.399, 0.799);   // Reading
  drawScore(formatBand(moduleBands.writing), 0.255, 0.848);   // Writing
  drawScore(formatBand(moduleBands.speaking), 0.399, 0.848);  // Speaking

  // Generate QR Code with certificate details
  const qrCodeData = [
    `Certificate ID: ${certificateId}`,
    `Register Number: ${registerNumber}`,
    `Issued On: ${issuedDate}`,
    `Verify: ${verificationUrl}`,
  ].join('\n');

  const qrCodeDataUrl = await generateQRCodeDataUrl(qrCodeData);
  const qrCodeImageBytes = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
  const qrCodeImage = await pdfDocument.embedPng(qrCodeImageBytes);

  // Position QR code in the top-left area, vertically centered
  const qrSize = pageWidth * 0.11; // Slightly smaller for better fit
  const qrX = pageWidth * 0.045; // Left margin
  const qrY = pageHeight * 0.42; // Vertically centered (50% - half of QR size)

  page.drawImage(qrCodeImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  return pdfDocument.save();
}