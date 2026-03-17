/**
 * Document Parsers Index
 * 
 * Central export point for all document parsers
 */

// PDF Parser
export {
  parsePDF,
  type ParsedPDF,
  type PDFPage,
  type PDFMetadata,
  isScannedPDF,
  performOCR,
  extractPageRange,
  searchInPDF,
  IngestionParserError as PDFParserError,
} from './pdf';

// DOCX Parser
export {
  parseDOCX,
  type ParsedDOCX,
  type DOCXParagraph,
  type DOCXSection,
  type DOCXMetadata,
  extractOutline,
  extractBySection,
  convertToMarkdown,
  isValidDOCX,
  DOCXParserError,
} from './docx';

// TXT Parser
export {
  parseText,
  type ParsedText,
  type TextLine,
  type TextBlock,
  type TextParseOptions,
  parseTextStream,
  extractByLineRange,
  searchInText,
  extractCodeBlocks,
  extractMarkdownHeadings,
  TextParserError,
} from './txt';

// HTML Parser
export {
  parseHTML,
  type ParsedHTML,
  type HTMLMetadata,
  type HTMLSection,
  type HTMLParseOptions,
  extractArticle,
  resolveUrl,
  isArticle,
  HTMLParserError,
} from './html';

// URL Scraper
export {
  scrapeURL,
  type ScrapedPage,
  type URLScrapeOptions,
  type PaginationOptions,
  type RobotsTxt,
  scrapePaginated,
  scrapeArticle,
  batchScrapeURLs,
  checkRobotsTxt,
  URLScraperError,
} from './url';
