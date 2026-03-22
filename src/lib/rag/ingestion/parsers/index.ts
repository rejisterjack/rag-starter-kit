/**
 * Document Parsers Index
 *
 * Central export point for all document parsers
 */

// OCR Config re-exports
export {
  createConfigFromEnv,
  DEFAULT_OCR_CONFIG,
  getLanguageOptions,
  isValidLanguage,
  OCRConfigBuilder,
  type OCRConfiguration,
  OCREngineMode,
  type OCROptions,
  type OCRPageResult,
  type OCRProgress,
  type OCRProgressCallback,
  type OCRResult,
  PageSegmentationMode,
} from '../ocr-config';
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
  detectImageFormat,
  getImageDimensions,
  getOCRVersion,
  type ImagePreprocessOptions,
  isOCRAvailable,
  isPDF2PicAvailable,
  isValidImage,
  type OCRMetadata,
  type OCRPage,
  OCRParserError,
  type OCRTextBlock,
  type ParsedOCRDocument,
  parseImageWithOCR,
  parsePDFWithOCRFallback,
  preprocessImage,
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

// XLSX Parser
export {
  convertToMarkdown as convertXLSXToMarkdown,
  extractSheet,
  extractSheetByIndex,
  getColumnValues,
  isValidXLSX,
  parseXLSX,
  type ParsedXLSX,
  type XLSXCell,
  type XLSXMetadata,
  type XLSXRow,
  type XLSXSheet,
  XLSXParserError,
} from './xlsx';

// PPTX Parser
export {
  convertToMarkdown as convertPPTXToMarkdown,
  extractSlide as extractPPTXSlide,
  extractSlidesByType,
  getOutline,
  getSlideText,
  isValidPPTX,
  parsePPTX,
  type ParsedPPTX,
  type PPTXMetadata,
  type PPTXParagraph,
  type PPTXShape,
  type PPTXSlide,
  type PPTXTextRun,
  PPTXParserError,
  searchInPPTX,
} from './pptx';
