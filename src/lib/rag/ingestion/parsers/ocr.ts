/**
 * OCR (Optical Character Recognition) Module
 * 
 * Stub implementation - OCR features require additional dependencies:
 * - pdf2pic: Convert PDF pages to images
 * - tesseract.js: Client-side OCR (or Tesseract CLI for server-side)
 * 
 * To enable full OCR support, install:
 * npm install pdf2pic tesseract.js
 */

export interface OCROptions {
  engine: 'tesseract' | 'google-vision';
  autoDetect?: boolean;
  language?: string;
}

export interface OCRPageResult {
  pageNumber: number;
  text: string;
  confidence?: number;
}

export interface OCRResult {
  text: string;
  pages: OCRPageResult[];
  metadata: {
    pageCount: number;
    processingTime?: number;
  };
}

/**
 * Parse PDF with OCR fallback
 * 
 * NOTE: This is a stub implementation. OCR features require pdf2pic and tesseract.js
 * which are heavy dependencies not included by default.
 */
export async function parsePDFWithOCRFallback(
  _buffer: Buffer,
  _options: OCROptions
): Promise<OCRResult> {
  // OCR is not implemented in this version
  // Install pdf2pic and tesseract.js to enable
  throw new Error(
    'OCR features are not enabled. ' +
    'Install pdf2pic and tesseract.js to use OCR capabilities.'
  );
}

/**
 * Check if OCR is available
 */
export function isOCRAvailable(): boolean {
  return false;
}
