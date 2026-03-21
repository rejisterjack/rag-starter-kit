/**
 * OCR (Optical Character Recognition) Module
 *
 * Full implementation using tesseract.js for text extraction from images and scanned PDFs.
 * Supports image preprocessing with sharp for improved accuracy.
 */

import sharp from 'sharp';
import { createWorker, type OEM, PSM } from 'tesseract.js';
import type {
  OCRConfiguration,
  OCROptions,
  OCRPageResult,
  OCRProgressCallback,
  OCRResult,
} from '../ocr-config';
import { DEFAULT_OCR_CONFIG, type OCREngineMode, type PageSegmentationMode } from '../ocr-config';
import type { ParsedDocument } from '../pipeline';

// =============================================================================
// Types
// =============================================================================

export interface OCRTextBlock {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  paragraph?: number;
  line?: number;
  word?: number;
}

export interface OCRPage {
  pageNumber: number;
  text: string;
  confidence: number;
  blocks: OCRTextBlock[];
  characterCount: number;
}

export interface OCRMetadata {
  pageCount: number;
  processingTime: number;
  averageConfidence: number;
  language: string;
  oem: OCREngineMode;
  psm: PageSegmentationMode;
  preprocessingApplied: boolean;
}

export interface ParsedOCRDocument {
  text: string;
  pages: OCRPage[];
  metadata: OCRMetadata;
}

export interface ImagePreprocessOptions {
  /** Deskew (straighten tilted images) */
  deskew?: boolean;
  /** Denoise the image */
  denoise?: boolean;
  /** Enhance contrast */
  contrastEnhancement?: boolean;
  /** Binarization threshold (0-255, undefined for adaptive) */
  binarizeThreshold?: number;
  /** Resize long edge to this value (undefined to disable) */
  maxDimension?: number;
  /** Minimum DPI for OCR */
  minDpi?: number;
}

// =============================================================================
// Worker Pool Management
// =============================================================================

// =============================================================================
// Image Preprocessing
// =============================================================================

/**
 * Preprocess image for better OCR accuracy
 */
export async function preprocessImage(
  buffer: Buffer,
  options: ImagePreprocessOptions = {},
  onProgress?: OCRProgressCallback
): Promise<Buffer> {
  const startTime = Date.now();
  await onProgress?.({
    stage: 'preprocess',
    progress: 0,
    message: 'Starting image preprocessing...',
  });

  let pipeline = sharp(buffer);

  // Get image metadata
  const metadata = await pipeline.metadata();
  const { width = 0, height = 0 } = metadata;

  // Resize if needed
  if (options.maxDimension && (width > options.maxDimension || height > options.maxDimension)) {
    pipeline = pipeline.resize(options.maxDimension, options.maxDimension, {
      fit: 'inside',
      withoutEnlargement: true,
    });
    await onProgress?.({
      stage: 'preprocess',
      progress: 20,
      message: 'Resizing image...',
    });
  }

  // Enhance contrast
  if (options.contrastEnhancement) {
    pipeline = pipeline.normalize();
    await onProgress?.({
      stage: 'preprocess',
      progress: 40,
      message: 'Enhancing contrast...',
    });
  }

  // Denoise
  if (options.denoise) {
    pipeline = pipeline.median(1);
    await onProgress?.({
      stage: 'preprocess',
      progress: 60,
      message: 'Denoising image...',
    });
  }

  // Binarization (convert to black and white)
  if (options.binarizeThreshold !== undefined) {
    pipeline = pipeline.threshold(options.binarizeThreshold);
    await onProgress?.({
      stage: 'preprocess',
      progress: 80,
      message: 'Binarizing image...',
    });
  } else if (options.binarizeThreshold === undefined && options.contrastEnhancement) {
    // Adaptive thresholding via normalization already applied
    pipeline = pipeline.greyscale();
  }

  // Convert to grayscale for better OCR
  pipeline = pipeline.greyscale();

  // Output as PNG for best compatibility
  const processedBuffer = await pipeline.png().toBuffer();

  await onProgress?.({
    stage: 'preprocess',
    progress: 100,
    message: `Preprocessing complete (${Date.now() - startTime}ms)`,
  });

  return processedBuffer;
}

/**
 * Check if buffer is a valid image
 */
export async function isValidImage(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();
    return !!metadata.format;
  } catch {
    return false;
  }
}

/**
 * Detect image format from buffer
 */
export async function detectImageFormat(buffer: Buffer): Promise<string | null> {
  try {
    const metadata = await sharp(buffer).metadata();
    return metadata.format || null;
  } catch {
    return null;
  }
}

/**
 * Get image dimensions
 */
export async function getImageDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

// =============================================================================
// OCR Core Functions
// =============================================================================

/**
 * Parse an image with OCR and return structured results
 */
export async function parseImageWithOCR(
  buffer: Buffer,
  config: Partial<OCRConfiguration> = {},
  onProgress?: OCRProgressCallback
): Promise<ParsedDocument> {
  const fullConfig = { ...DEFAULT_OCR_CONFIG, ...config };
  const startTime = Date.now();

  try {
    // Validate image
    if (!(await isValidImage(buffer))) {
      throw new OCRParserError('Invalid image file', 'INVALID_IMAGE');
    }

    // Preprocess image if enabled
    let processedBuffer = buffer;
    if (fullConfig.preprocessing.enabled) {
      processedBuffer = await preprocessImage(
        buffer,
        {
          deskew: fullConfig.preprocessing.deskew,
          denoise: fullConfig.preprocessing.denoise,
          contrastEnhancement: fullConfig.preprocessing.contrastEnhancement,
          binarizeThreshold: fullConfig.preprocessing.binarizeThreshold ?? undefined,
          maxDimension: fullConfig.preprocessing.maxDimension ?? undefined,
        },
        onProgress
      );
    }

    await onProgress?.({
      stage: 'recognize',
      progress: 0,
      message: 'Starting OCR recognition...',
    });

    // Initialize worker with configuration
    const worker = await createWorker(
      fullConfig.language,
      fullConfig.oem as unknown as OEM,
      fullConfig.logger ? { logger: fullConfig.logger } : undefined
    );

    // Set PSM mode
    await worker.setParameters({
      tessedit_pageseg_mode: fullConfig.psm as unknown as PSM,
    });

    await onProgress?.({
      stage: 'recognize',
      progress: 30,
      message: 'Running OCR engine...',
    });

    // Perform OCR
    const result = await worker.recognize(processedBuffer);

    await onProgress?.({
      stage: 'recognize',
      progress: 80,
      message: 'Processing OCR results...',
    });

    // Terminate worker
    await worker.terminate();

    // Extract text blocks with bounding boxes
    const blocks: OCRTextBlock[] = [];
    // Access paragraphs from the result data
    const paragraphs = (
      result.data as unknown as {
        paragraphs?: Array<{
          lines: Array<{
            words: Array<{ text: string; confidence: number; bbox: OCRTextBlock['bbox'] }>;
          }>;
        }>;
      }
    ).paragraphs;

    if (paragraphs) {
      for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
        const paragraph = paragraphs[pIdx];
        if (paragraph.lines) {
          for (let lIdx = 0; lIdx < paragraph.lines.length; lIdx++) {
            const line = paragraph.lines[lIdx];
            if (line.words) {
              for (let wIdx = 0; wIdx < line.words.length; wIdx++) {
                const word = line.words[wIdx];
                if (word.bbox) {
                  blocks.push({
                    text: word.text,
                    confidence: word.confidence,
                    bbox: word.bbox,
                    paragraph: pIdx,
                    line: lIdx,
                    word: wIdx,
                  });
                }
              }
            }
          }
        }
      }
    }

    const processingTime = Date.now() - startTime;

    await onProgress?.({
      stage: 'recognize',
      progress: 100,
      message: 'OCR recognition complete',
    });

    const confidence = result.data.confidence;
    const text = result.data.text;

    // Check confidence threshold
    if (confidence < fullConfig.confidenceThreshold) {
    }

    await onProgress?.({
      stage: 'complete',
      progress: 100,
      message: `OCR complete: ${text.length} characters extracted`,
    });

    return {
      type: 'IMAGE',
      content: text,
      metadata: {
        confidence,
        processingTime,
        language: fullConfig.language,
        oem: fullConfig.oem,
        psm: fullConfig.psm,
        preprocessingApplied: fullConfig.preprocessing.enabled,
        characterCount: text.length,
        wordCount: text.split(/\s+/).filter((w) => w.length > 0).length,
        blocks: blocks.slice(0, 100), // Limit blocks stored in metadata
      },
    };
  } catch (error) {
    if (error instanceof OCRParserError) {
      throw error;
    }
    throw new OCRParserError(
      `OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PROCESSING_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Parse PDF with OCR fallback for scanned documents
 */
export async function parsePDFWithOCRFallback(
  buffer: Buffer,
  _options: OCROptions = { engine: 'tesseract' }
): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    // Convert PDF to images (requires pdf2pic)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { fromBuffer } = (await import('pdf2pic')) as unknown as {
      fromBuffer: (
        buffer: Buffer,
        options: Record<string, unknown>
      ) => { bulk: (pages: number) => Promise<Array<{ base64: string }>> };
    };

    const convert = fromBuffer(buffer, {
      density: 200, // DPI
      format: 'png',
      width: 2000,
      height: 2000,
      preserveAspectRatio: true,
    });

    // Get all pages as images
    const images = await convert.bulk(-1); // -1 for all pages

    const pages: OCRPageResult[] = [];
    const config = DEFAULT_OCR_CONFIG;

    // Process each page
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      if (!image.base64) continue;

      const imageBuffer = Buffer.from(image.base64, 'base64');

      // Run OCR on the page image
      const worker = await createWorker(config.language, config.oem as unknown as OEM);
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
      });

      const result = await worker.recognize(imageBuffer);
      await worker.terminate();

      pages.push({
        pageNumber: i + 1,
        text: result.data.text,
        confidence: result.data.confidence,
      });
    }

    const fullText = pages.map((p) => p.text).join('\n\n');
    const avgConfidence = pages.reduce((sum, p) => sum + (p.confidence || 0), 0) / pages.length;

    return {
      text: fullText,
      pages,
      metadata: {
        pageCount: pages.length,
        processingTime: Date.now() - startTime,
        averageConfidence: avgConfidence,
      },
    };
  } catch (error) {
    // If pdf2pic is not available, throw a specific error
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      throw new OCRParserError(
        'PDF OCR requires pdf2pic. Install with: npm install pdf2pic',
        'MISSING_DEPENDENCY',
        error
      );
    }
    throw new OCRParserError(
      `PDF OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'PROCESSING_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Batch process multiple images
 */
export async function batchOCR(
  buffers: Buffer[],
  config: Partial<OCRConfiguration> = {},
  onProgress?: (current: number, total: number) => void
): Promise<ParsedDocument[]> {
  const results: ParsedDocument[] = [];

  for (let i = 0; i < buffers.length; i++) {
    onProgress?.(i + 1, buffers.length);

    const result = await parseImageWithOCR(buffers[i], config);
    results.push(result);
  }

  return results;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if OCR is available
 */
export function isOCRAvailable(): boolean {
  try {
    // Try to require tesseract.js
    require.resolve('tesseract.js');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if pdf2pic is available for PDF OCR
 */
export function isPDF2PicAvailable(): boolean {
  try {
    require.resolve('pdf2pic');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get OCR engine version info
 */
export async function getOCRVersion(): Promise<{
  tesseractVersion: string;
  version: string;
}> {
  const tesseract = await import('tesseract.js');
  const worker = await createWorker();
  // Get version info from worker
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const versionInfo = await (worker as any).getVersion?.();
  await worker.terminate();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tesseractVersion = (tesseract as any).version || 'unknown';

  return {
    tesseractVersion: versionInfo?.tesseractVersion || 'unknown',
    version: typeof tesseractVersion === 'string' ? tesseractVersion : 'unknown',
  };
}

// =============================================================================
// Error Handling
// =============================================================================

export class OCRParserError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_IMAGE' | 'PROCESSING_ERROR' | 'TIMEOUT' | 'MISSING_DEPENDENCY',
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'OCRParserError';
  }
}

// =============================================================================
// Re-exports from config
// =============================================================================

export type {
  OCRConfiguration,
  OCROptions,
  OCRPageResult,
  OCRProgress,
  OCRProgressCallback,
  OCRResult,
} from '../ocr-config';
export {
  createConfigFromEnv,
  DEFAULT_OCR_CONFIG,
  getLanguageOptions,
  isValidLanguage,
  OCRConfigBuilder,
  OCREngineMode,
  PageSegmentationMode,
} from '../ocr-config';
