/**
 * Document Parsers Index
 *
 * Central export point for all document parsers
 */

// DOCX Parser
export {
  convertToMarkdown,
  type DOCXMetadata,
  type DOCXParagraph,
  DOCXParserError,
  type DOCXSection,
  extractBySection,
  extractOutline,
  isValidDOCX,
  type ParsedDOCX,
  parseDOCX,
} from './docx';

// HTML Parser
export {
  type HTMLMetadata,
  type HTMLSection,
  type ParsedHTML,
  parseHTML,
  scrapeURL as scrapeHTML, // Alias for consistency
} from './html';

// OCR Parser
export {
  batchOCR,
  type OCRMetadata,
  OCRParserError,
  type OCRPage,
  type OCRTextBlock,
  type ImagePreprocessOptions,
  type ParsedOCRDocument,
  detectImageFormat,
  getImageDimensions,
  isOCRAvailable,
  isPDF2PicAvailable,
  isValidImage,
  parseImageWithOCR,
  parsePDFWithOCRFallback,
  preprocessImage,
  getOCRVersion,
} from './ocr';

// PDF Parser
export {
  extractPageRange,
  IngestionParserError as PDFParserError,
  isScannedPDF,
  type ParsedPDF,
  type PDFMetadata,
  type PDFPage,
  parsePDF,
  performOCR,
  searchInPDF,
} from './pdf';

// TXT Parser
export {
  extractByLineRange,
  extractCodeBlocks,
  extractMarkdownHeadings,
  type ParsedText,
  parseText,
  parseTextStream,
  searchInText,
  type TextBlock,
  type TextLine,
  type TextParseOptions,
  TextParserError,
} from './txt';

// URL Scraper
export {
  batchScrapeURLs,
  checkRobotsTxt,
  type PaginationOptions,
  type RobotsTxt,
  type ScrapedPage,
  scrapeArticle,
  scrapePaginated,
  scrapeURL,
  type URLScrapeOptions,
  URLScraperError,
} from './url';

// OCR Config re-exports
export {
  DEFAULT_OCR_CONFIG,
  OCREngineMode,
  PageSegmentationMode,
  OCRConfigBuilder,
  getLanguageOptions,
  isValidLanguage,
  createConfigFromEnv,
  type OCRConfiguration,
  type OCRResult,
  type OCRPageResult,
  type OCRProgress,
  type OCRProgressCallback,
  type OCROptions,
} from '../ocr-config';
