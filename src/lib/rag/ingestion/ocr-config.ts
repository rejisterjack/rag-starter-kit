/**
 * OCR Configuration Module
 *
 * Centralized configuration for OCR operations including:
 * - Language settings
 * - OCR Engine Modes (OEM)
 * - Page Segmentation Modes (PSM)
 * - Confidence thresholds
 * - Image preprocessing options
 */

import type { WorkerOptions } from 'tesseract.js';

// =============================================================================
// OCR Engine Modes (OEM)
// =============================================================================

/**
 * OCR Engine Modes determine which Tesseract engine to use
 * @see https://github.com/tesseract-ocr/tesseract/blob/main/doc/tesseract.1.asc#ocr-engine-modes-oem
 */
export enum OCREngineMode {
  /** Legacy engine only */
  LEGACY_ONLY = 0,
  /** Neural nets LSTM engine only */
  LSTM_ONLY = 1,
  /** Legacy + LSTM engines */
  LEGACY_LSTM_COMBINED = 2,
  /** Default, based on what is available */
  DEFAULT = 3,
}

// =============================================================================
// Page Segmentation Modes (PSM)
// =============================================================================

/**
 * Page Segmentation Modes determine how Tesseract splits text into regions
 * @see https://github.com/tesseract-ocr/tesseract/blob/main/doc/tesseract.1.asc#page-segmentation-modes-psm
 */
export enum PageSegmentationMode {
  /** Orientation and script detection (OSD) only */
  OSD_ONLY = 0,
  /** Automatic page segmentation with OSD */
  AUTO_OSD = 1,
  /** Automatic page segmentation, but no OSD, or OCR */
  AUTO_ONLY = 2,
  /** Fully automatic page segmentation, but no OSD (Default) */
  AUTO = 3,
  /** Assume a single column of text of variable sizes */
  SINGLE_COLUMN = 4,
  /** Assume a single uniform block of vertically aligned text */
  SINGLE_BLOCK_VERT_TEXT = 5,
  /** Assume a single uniform block of text */
  SINGLE_BLOCK = 6,
  /** Treat the image as a single text line */
  SINGLE_LINE = 7,
  /** Treat the image as a single word */
  SINGLE_WORD = 8,
  /** Treat the image as a single word in a circle */
  CIRCLE_WORD = 9,
  /** Treat the image as a single character */
  SINGLE_CHAR = 10,
  /** Sparse text. Find as much text as possible in no particular order */
  SPARSE_TEXT = 11,
  /** Sparse text with OSD */
  SPARSE_TEXT_OSD = 12,
  /** Raw line. Treat the image as a single text line, bypassing hacks that are Tesseract-specific */
  RAW_LINE = 13,
}

// =============================================================================
// Types
// =============================================================================

export interface OCRResult {
  text: string;
  pages: OCRPageResult[];
  metadata: {
    pageCount: number;
    processingTime?: number;
    averageConfidence?: number;
  };
}

export interface OCRPageResult {
  pageNumber: number;
  text: string;
  confidence?: number;
}

export interface OCRProgress {
  stage: 'preprocess' | 'recognize' | 'analyze' | 'complete';
  progress: number; // 0-100
  message: string;
  pageNumber?: number;
  totalPages?: number;
}

export type OCRProgressCallback = (progress: OCRProgress) => void | Promise<void>;

export interface OCROptions {
  engine: 'tesseract' | 'google-vision';
  autoDetect?: boolean;
  language?: string;
}

// =============================================================================
// Configuration Interface
// =============================================================================

export interface OCRConfiguration {
  /** Language code(s) for OCR (e.g., 'eng', 'eng+deu') */
  language: string;
  /** OCR Engine Mode */
  oem: OCREngineMode;
  /** Page Segmentation Mode */
  psm: PageSegmentationMode;
  /** Minimum confidence score (0-100) to accept OCR result */
  confidenceThreshold: number;
  /** Enable image preprocessing */
  preprocessing: {
    enabled: boolean;
    /** Deskew (straighten tilted images) */
    deskew: boolean;
    /** Denoise the image */
    denoise: boolean;
    /** Enhance contrast */
    contrastEnhancement: boolean;
    /** Binarization threshold (0-255, null for adaptive) */
    binarizeThreshold: number | null;
    /** Resize long edge to this value (null to disable) */
    maxDimension: number | null;
    /** Minimum DPI for OCR (will upscale if below) */
    minDpi: number;
  };
  /** Tesseract.js worker options */
  workerOptions?: Partial<WorkerOptions>;
  /** Timeout for OCR operations in milliseconds */
  timeoutMs: number;
  /** Enable progress tracking callbacks */
  enableProgressTracking: boolean;
  /** Tessdata path for trained language data */
  tessdataPath?: string;
  /** Logger function for OCR operations */
  logger?: (message: { status: string; progress: number }) => void;
}

// =============================================================================
// Default Configuration
// =============================================================================

export const DEFAULT_OCR_CONFIG: OCRConfiguration = {
  language: 'eng',
  oem: OCREngineMode.LSTM_ONLY,
  psm: PageSegmentationMode.AUTO,
  confidenceThreshold: 60,
  preprocessing: {
    enabled: true,
    deskew: true,
    denoise: true,
    contrastEnhancement: true,
    binarizeThreshold: null, // Adaptive thresholding
    maxDimension: 3000, // Resize if larger than 3000px
    minDpi: 150,
  },
  timeoutMs: 120000, // 2 minutes
  enableProgressTracking: true,
};

// =============================================================================
// Language Support
// =============================================================================

/**
 * Common language codes for Tesseract
 * @see https://github.com/tesseract-ocr/tessdata
 */
export const SUPPORTED_LANGUAGES: Record<string, string> = {
  eng: 'English',
  deu: 'German',
  fra: 'French',
  spa: 'Spanish',
  ita: 'Italian',
  por: 'Portuguese',
  rus: 'Russian',
  chi_sim: 'Chinese (Simplified)',
  chi_tra: 'Chinese (Traditional)',
  jpn: 'Japanese',
  kor: 'Korean',
  ara: 'Arabic',
  hin: 'Hindi',
  tha: 'Thai',
  vie: 'Vietnamese',
  nld: 'Dutch',
  pol: 'Polish',
  tur: 'Turkish',
  swe: 'Swedish',
  nor: 'Norwegian',
  dan: 'Danish',
  fin: 'Finnish',
  ces: 'Czech',
  hun: 'Hungarian',
  ell: 'Greek',
  heb: 'Hebrew',
  ind: 'Indonesian',
  msa: 'Malay',
  swe_frak: 'Swedish (Fraktur)',
};

/**
 * Get supported languages as array of options
 */
export function getLanguageOptions(): Array<{ code: string; name: string }> {
  return Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({ code, name }));
}

/**
 * Validate language code
 */
export function isValidLanguage(language: string): boolean {
  // Support combined languages like "eng+deu"
  const codes = language.split('+').map((l) => l.trim());
  return codes.every((code) => code in SUPPORTED_LANGUAGES);
}

// =============================================================================
// Configuration Builder
// =============================================================================

export class OCRConfigBuilder {
  private config: Partial<OCRConfiguration> = {};

  /**
   * Set the OCR language
   */
  withLanguage(language: string): this {
    this.config.language = language;
    return this;
  }

  /**
   * Set the OCR Engine Mode
   */
  withOEM(oem: OCREngineMode): this {
    this.config.oem = oem;
    return this;
  }

  /**
   * Set the Page Segmentation Mode
   */
  withPSM(psm: PageSegmentationMode): this {
    this.config.psm = psm;
    return this;
  }

  /**
   * Set the confidence threshold
   */
  withConfidenceThreshold(threshold: number): this {
    this.config.confidenceThreshold = threshold;
    return this;
  }

  /**
   * Configure preprocessing options
   */
  withPreprocessing(options: Partial<OCRConfiguration['preprocessing']>): this {
    this.config.preprocessing = { ...DEFAULT_OCR_CONFIG.preprocessing, ...options };
    return this;
  }

  /**
   * Disable preprocessing
   */
  withoutPreprocessing(): this {
    this.config.preprocessing = { ...DEFAULT_OCR_CONFIG.preprocessing, enabled: false };
    return this;
  }

  /**
   * Set timeout
   */
  withTimeout(timeoutMs: number): this {
    this.config.timeoutMs = timeoutMs;
    return this;
  }

  /**
   * Enable progress tracking
   */
  withProgressTracking(enabled = true): this {
    this.config.enableProgressTracking = enabled;
    return this;
  }

  /**
   * Set worker options
   */
  withWorkerOptions(options: Partial<WorkerOptions>): this {
    this.config.workerOptions = options;
    return this;
  }

  /**
   * Set logger function
   */
  withLogger(logger: OCRConfiguration['logger']): this {
    this.config.logger = logger;
    return this;
  }

  /**
   * Build the final configuration
   */
  build(): OCRConfiguration {
    return {
      ...DEFAULT_OCR_CONFIG,
      ...this.config,
      preprocessing: {
        ...DEFAULT_OCR_CONFIG.preprocessing,
        ...this.config.preprocessing,
      },
    };
  }

  /**
   * Create configuration optimized for scanned documents
   */
  static forScannedDocuments(): OCRConfiguration {
    return new OCRConfigBuilder()
      .withPSM(PageSegmentationMode.AUTO)
      .withOEM(OCREngineMode.LSTM_ONLY)
      .withPreprocessing({
        enabled: true,
        deskew: true,
        denoise: true,
        contrastEnhancement: true,
        binarizeThreshold: null,
        maxDimension: 3000,
        minDpi: 200,
      })
      .build();
  }

  /**
   * Create configuration optimized for single-line text
   */
  static forSingleLine(): OCRConfiguration {
    return new OCRConfigBuilder()
      .withPSM(PageSegmentationMode.SINGLE_LINE)
      .withOEM(OCREngineMode.LSTM_ONLY)
      .withPreprocessing({
        enabled: true,
        deskew: false,
        denoise: true,
        contrastEnhancement: true,
        binarizeThreshold: 128,
        maxDimension: null,
        minDpi: 150,
      })
      .build();
  }

  /**
   * Create configuration optimized for receipts/invoices
   */
  static forReceipts(): OCRConfiguration {
    return new OCRConfigBuilder()
      .withPSM(PageSegmentationMode.SINGLE_BLOCK)
      .withOEM(OCREngineMode.LSTM_ONLY)
      .withPreprocessing({
        enabled: true,
        deskew: true,
        denoise: true,
        contrastEnhancement: true,
        binarizeThreshold: null,
        maxDimension: 2000,
        minDpi: 200,
      })
      .build();
  }

  /**
   * Create fast configuration (lower accuracy, faster processing)
   */
  static forFastProcessing(): OCRConfiguration {
    return new OCRConfigBuilder()
      .withPSM(PageSegmentationMode.AUTO)
      .withOEM(OCREngineMode.LSTM_ONLY)
      .withConfidenceThreshold(50)
      .withPreprocessing({
        enabled: true,
        deskew: false,
        denoise: false,
        contrastEnhancement: true,
        binarizeThreshold: null,
        maxDimension: 1500,
        minDpi: 100,
      })
      .build();
  }
}

// =============================================================================
// Environment-based Configuration
// =============================================================================

/**
 * Create OCR configuration from environment variables
 */
export function createConfigFromEnv(): OCRConfiguration {
  const builder = new OCRConfigBuilder();

  if (process.env.OCR_LANGUAGE) {
    builder.withLanguage(process.env.OCR_LANGUAGE);
  }

  if (process.env.OCR_OEM) {
    builder.withOEM(Number.parseInt(process.env.OCR_OEM, 10) as OCREngineMode);
  }

  if (process.env.OCR_PSM) {
    builder.withPSM(Number.parseInt(process.env.OCR_PSM, 10) as PageSegmentationMode);
  }

  if (process.env.OCR_CONFIDENCE_THRESHOLD) {
    builder.withConfidenceThreshold(Number.parseFloat(process.env.OCR_CONFIDENCE_THRESHOLD));
  }

  if (process.env.OCR_TIMEOUT_MS) {
    builder.withTimeout(Number.parseInt(process.env.OCR_TIMEOUT_MS, 10));
  }

  return builder.build();
}
