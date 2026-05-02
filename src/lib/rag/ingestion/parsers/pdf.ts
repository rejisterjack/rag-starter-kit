/**
 * PDF Parser with OCR fallback support
 * Extracts text, metadata, and page-level content from PDF documents
 */

import { logger } from '@/lib/logger';

// pdf-parse is imported dynamically below

export interface PDFPage {
  pageNumber: number;
  text: string;
  characterCount: number;
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pageCount: number;
  encrypted: boolean;
}

export interface ParsedPDF {
  text: string;
  pages: PDFPage[];
  metadata: PDFMetadata;
  totalCharacters: number;
}

/**
 * Parse a PDF buffer and extract text with page-level mapping
 */
export async function parsePDF(buffer: Buffer): Promise<ParsedPDF> {
  try {
    // Dynamic import to handle module format issues
    const pdfModule = await import('pdf-parse');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseFn = (
      pdfModule as unknown as {
        default: (
          buffer: Buffer,
          opts?: { max?: number }
        ) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
      }
    ).default;
    const data = await parseFn(buffer, {
      // Enable max pages limit if needed for very large PDFs
      max: 0, // 0 = no limit
    });

    const text = data.text;
    const pageCount = data.numpages;

    // Parse page-level content if available
    // pdf-parse doesn't give us direct page mapping, so we estimate
    const pages = extractPages(text, pageCount);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info = data.info as Record<string, unknown>;

    const metadata: PDFMetadata = {
      title: info?.Title ? String(info.Title) : undefined,
      author: info?.Author ? String(info.Author) : undefined,
      subject: info?.Subject ? String(info.Subject) : undefined,
      keywords: info?.Keywords ? String(info.Keywords) : undefined,
      creator: info?.Creator ? String(info.Creator) : undefined,
      producer: info?.Producer ? String(info.Producer) : undefined,
      creationDate: info?.CreationDate ? parsePDFDate(String(info.CreationDate)) : undefined,
      modificationDate: info?.ModDate ? parsePDFDate(String(info.ModDate)) : undefined,
      pageCount,
      encrypted: false, // pdf-parse handles decryption
    };

    return {
      text,
      pages,
      metadata,
      totalCharacters: text.length,
    };
  } catch (error) {
    throw new IngestionParserError(
      'parse',
      `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Extract pages from PDF text using heuristic page breaks
 * Note: pdf-parse doesn't provide exact page boundaries, so we estimate
 */
function extractPages(fullText: string, pageCount: number): PDFPage[] {
  if (pageCount <= 1) {
    return [
      {
        pageNumber: 1,
        text: fullText.trim(),
        characterCount: fullText.length,
      },
    ];
  }

  // Common page break patterns in extracted text
  // const pageBreakPatterns = [
  //   /\f/, // Form feed character
  //   /\n\s*\n\s*\d+\s*\n\s*\n/, // Page numbers surrounded by blank lines
  //   /\n-{3,}\s*\n/, // Horizontal rule separators
  // ];

  const pages: PDFPage[] = [];
  let currentPosition = 0;

  // Try to find natural page breaks
  const estimatedPageLength = Math.ceil(fullText.length / pageCount);

  for (let i = 0; i < pageCount; i++) {
    const start = currentPosition;
    let end: number;

    if (i === pageCount - 1) {
      // Last page - take remaining text
      end = fullText.length;
    } else {
      // Look for page break patterns around estimated position
      const estimatedEnd = Math.min(
        start + estimatedPageLength + 1000, // Add buffer for variation
        fullText.length
      );

      // Try to find a natural break (paragraph end)
      const searchStart = Math.max(start + estimatedPageLength * 0.8, start);
      end = findNaturalBreak(fullText, searchStart, estimatedEnd);
    }

    const pageText = fullText.slice(start, end).trim();

    pages.push({
      pageNumber: i + 1,
      text: pageText,
      characterCount: pageText.length,
    });

    currentPosition = end;
  }

  return pages.filter((p) => p.text.length > 0);
}

/**
 * Find a natural break point (end of paragraph) for page boundary
 */
function findNaturalBreak(text: string, searchStart: number, searchEnd: number): number {
  const searchText = text.slice(searchStart, searchEnd);

  // Look for paragraph breaks
  const paragraphBreaks = searchText.match(/\n\s*\n/g);
  if (paragraphBreaks) {
    // Find the last paragraph break in the search range
    const lastBreak = searchText.lastIndexOf('\n\n');
    if (lastBreak !== -1) {
      return searchStart + lastBreak + 2;
    }
  }

  // Fall back to sentence end
  const sentenceEnd = searchText.match(/[.!?]\s+/g);
  if (sentenceEnd) {
    const lastSentence = searchText.lastIndexOf('. ');
    if (lastSentence !== -1) {
      return searchStart + lastSentence + 2;
    }
  }

  // Fall back to middle of range
  return Math.floor((searchStart + searchEnd) / 2);
}

/**
 * Parse PDF date format (D:YYYYMMDDHHmmSSOHH'mm')
 * Example: D:20220131120000+05'00'
 */
function parsePDFDate(dateString: string): Date | undefined {
  if (!dateString) return undefined;

  try {
    // Remove 'D:' prefix if present
    const cleanDate = dateString.replace(/^D:/, '');

    // Extract components: YYYYMMDDHHmmSS
    const year = parseInt(cleanDate.slice(0, 4), 10);
    const month = parseInt(cleanDate.slice(4, 6), 10) - 1; // 0-indexed
    const day = parseInt(cleanDate.slice(6, 8), 10);
    const hour = parseInt(cleanDate.slice(8, 10), 10);
    const minute = parseInt(cleanDate.slice(10, 12), 10);
    const second = parseInt(cleanDate.slice(12, 14), 10);

    // Handle timezone offset if present
    let offset = 0;
    const tzMatch = cleanDate.match(/([+-])(\d{2})'(\d{2})/);
    if (tzMatch) {
      const sign = tzMatch[1] === '+' ? 1 : -1;
      const tzHours = parseInt(tzMatch[2], 10);
      const tzMinutes = parseInt(tzMatch[3], 10);
      offset = sign * (tzHours * 60 + tzMinutes) * 60 * 1000;
    }

    const date = new Date(Date.UTC(year, month, day, hour, minute, second));
    return new Date(date.getTime() - offset);
  } catch (error: unknown) {
    logger.debug('PDF date parsing failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return undefined;
  }
}

/**
 * Check if PDF appears to be scanned (image-based) by analyzing text density
 */
export function isScannedPDF(parsedPDF: ParsedPDF): boolean {
  // Heuristic: Scanned PDFs have very low text density
  const avgCharsPerPage = parsedPDF.totalCharacters / parsedPDF.metadata.pageCount;

  // Normal PDFs typically have 1000+ characters per page
  // Scanned PDFs without OCR have very few or no extractable characters
  return avgCharsPerPage < 100;
}

/**
 * OCR fallback using pdf2pic + Tesseract
 * Automatically detects scanned PDFs and extracts text using OCR
 */
export async function performOCR(buffer: Buffer): Promise<string> {
  const { parsePDFWithOCRFallback } = await import('./ocr');

  const result = await parsePDFWithOCRFallback(buffer, {
    engine: 'tesseract',
    autoDetect: true,
  });

  return result.text;
}

/**
 * Parse PDF with automatic OCR detection
 * Uses OCR for scanned/image-based PDFs automatically
 */
export async function parsePDFWithOCR(buffer: Buffer): Promise<ParsedPDF> {
  const { parsePDFWithOCRFallback } = await import('./ocr');

  try {
    const ocrResult = await parsePDFWithOCRFallback(buffer, {
      engine: 'tesseract',
      autoDetect: true,
    });

    return {
      text: ocrResult.text,
      pages: ocrResult.pages.map((p) => ({
        pageNumber: p.pageNumber,
        text: p.text,
        characterCount: p.text.length,
      })),
      metadata: {
        pageCount: ocrResult.metadata.pageCount,
        title: undefined,
        author: undefined,
        subject: undefined,
        keywords: undefined,
        creator: undefined,
        producer: undefined,
        creationDate: undefined,
        modificationDate: undefined,
        encrypted: false,
      },
      totalCharacters: ocrResult.text.length,
    };
  } catch (error) {
    throw new IngestionParserError(
      'parse',
      `OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Custom error class for parser errors
 */
export class IngestionParserError extends Error {
  constructor(
    public readonly stage: 'parse' | 'chunk' | 'embed' | 'store',
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'IngestionParserError';
  }
}

/**
 * Extract text from specific page range
 */
export function extractPageRange(pages: PDFPage[], startPage: number, endPage: number): string {
  const startIndex = Math.max(0, startPage - 1);
  const endIndex = Math.min(pages.length, endPage);

  return pages
    .slice(startIndex, endIndex)
    .map((p) => p.text)
    .join('\n\n');
}

/**
 * Search for text within PDF pages
 */
export function searchInPDF(
  pages: PDFPage[],
  query: string
): Array<{ pageNumber: number; matches: number }> {
  const lowerQuery = query.toLowerCase();

  return pages
    .map((page) => ({
      pageNumber: page.pageNumber,
      matches: (page.text.toLowerCase().match(new RegExp(lowerQuery, 'g')) || []).length,
    }))
    .filter((result) => result.matches > 0);
}
