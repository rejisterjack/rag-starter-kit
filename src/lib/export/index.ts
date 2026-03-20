/**
 * Export Module
 *
 * Enterprise export features for RAG conversations.
 * Supports PDF, Word, and Markdown formats with citations.
 */

// =============================================================================
// Core Service
// =============================================================================

export type { ExportServiceConfig } from './export-service';
export {
  ExportService,
  ExportServiceError,
  getExportService,
  quickExportMarkdown,
  quickExportPDF,
  quickExportWord,
  resetExportService,
} from './export-service';

// =============================================================================
// Generators
// =============================================================================

export type { MarkdownGenerationOptions } from './markdown-generator';
export {
  citationsToFootnotes,
  convertCitationsToFootnotes,
  generateBulkMarkdown,
  generateMarkdown,
  MarkdownGenerationError,
  MarkdownGenerator,
} from './markdown-generator';
export type {
  PDFGenerationOptions,
  PDFGenerationProgress,
} from './pdf-generator';
// PDF Generator
export {
  generateBulkPDF,
  generatePDF,
  PDFGenerationError,
  PDFGenerator,
  quickPDF,
  StreamingPDFGenerator,
} from './pdf-generator';
export type { WordGenerationOptions } from './word-generator';
export {
  generateBulkWord,
  generateWord,
  WordGenerationError,
  WordGenerator,
} from './word-generator';

// =============================================================================
// Storage
// =============================================================================

export {
  ExportStorage,
  formatFileSize,
  generateExportFilename,
  getExportStorage,
  getMimeType,
  resetExportStorage,
} from './storage';

// StorageConfig and StoredFile are exported from './types'

// =============================================================================
// Types
// =============================================================================

export type {
  BulkExportOptions,
  CitationFormatter,
  CitationStyle,
  ExportCitation,
  ExportConversation,
  ExportEvent,
  ExportEventType,
  ExportFormat,
  ExportJob,
  ExportJobMetadata,
  ExportMessage,
  ExportOptions,
  ExportProgress,
  ExportResult,
  ExportSource,
  ExportStatus,
  FormattedCitation,
  PDFTemplateProps,
  WordTemplateData,
} from './types';

// =============================================================================
// Legacy Exports (for backward compatibility)
// =============================================================================

export {
  type ExportedConversation,
  type ExportOptions as LegacyExportOptions,
  exportConversationsToMarkdown,
  exportConversationToCSV,
  exportConversationToHTML,
  exportConversationToJSON,
  exportConversationToMarkdown,
  exportConversationToPDF,
} from './conversation-export';
