/**
 * Export Module
 *
 * Enterprise export features for RAG conversations.
 * Supports PDF, Word, and Markdown formats with citations.
 */

// =============================================================================
// Core Service
// =============================================================================

export {
  ExportService,
  getExportService,
  resetExportService,
  quickExportPDF,
  quickExportWord,
  quickExportMarkdown,
  ExportServiceError,
} from './export-service';

export type {
  ExportServiceConfig,
} from './export-service';

// =============================================================================
// Generators
// =============================================================================

// PDF Generator
export {
  PDFGenerator,
  generatePDF,
  generateBulkPDF,
  quickPDF,
  StreamingPDFGenerator,
  PDFGenerationError,
} from './pdf-generator';
export type {
  PDFGenerationOptions,
  PDFGenerationProgress,
} from './pdf-generator';

export {
  WordGenerator,
  generateWord,
  generateBulkWord,
  WordGenerationError,
} from './word-generator';

export type {
  WordGenerationOptions,
} from './word-generator';

export {
  MarkdownGenerator,
  generateMarkdown,
  generateBulkMarkdown,
  citationsToFootnotes,
  convertCitationsToFootnotes,
  MarkdownGenerationError,
} from './markdown-generator';

export type {
  MarkdownGenerationOptions,
} from './markdown-generator';

// =============================================================================
// Storage
// =============================================================================

export {
  ExportStorage,
  getExportStorage,
  resetExportStorage,
  generateExportFilename,
  getMimeType,
  formatFileSize,
} from './storage';

// StorageConfig and StoredFile are exported from './types'

// =============================================================================
// Types
// =============================================================================

export type {
  ExportFormat,
  CitationStyle,
  ExportStatus,
  ExportOptions,
  BulkExportOptions,
  ExportJob,
  ExportJobMetadata,
  ExportResult,
  ExportProgress,
  ExportConversation,
  ExportMessage,
  ExportSource,
  ExportCitation,
  PDFTemplateProps,
  WordTemplateData,
  FormattedCitation,
  CitationFormatter,
  ExportEventType,
  ExportEvent,
} from './types';

// =============================================================================
// Legacy Exports (for backward compatibility)
// =============================================================================

export {
  exportConversationToMarkdown,
  exportConversationsToMarkdown,
  exportConversationToPDF,
  exportConversationToHTML,
  exportConversationToJSON,
  exportConversationToCSV,
  type ExportOptions as LegacyExportOptions,
  type ExportedConversation,
} from './conversation-export';
