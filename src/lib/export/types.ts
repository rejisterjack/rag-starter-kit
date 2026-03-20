/**
 * Export Types
 * Type definitions for the enterprise export feature
 */

// =============================================================================
// Export Format Types
// =============================================================================

export type ExportFormat = 'pdf' | 'word' | 'markdown' | 'html' | 'json';

export type CitationStyle = 'inline-numbered' | 'footnotes' | 'harvard' | 'apa' | 'endnotes';

export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// =============================================================================
// Export Options
// =============================================================================

export interface ExportOptions {
  /** Export format */
  format: ExportFormat;
  /** Include citation references */
  includeCitations?: boolean;
  /** Citation formatting style */
  citationStyle?: CitationStyle;
  /** Include metadata section */
  includeMetadata?: boolean;
  /** Include source document references */
  includeSources?: boolean;
  /** Date format for timestamps */
  dateFormat?: 'iso' | 'locale' | 'relative';
  /** Maximum messages to export (for large conversations) */
  maxMessages?: number;
  /** Add confidential watermark */
  watermark?: boolean;
  /** Custom header text */
  headerText?: string;
  /** Custom footer text */
  footerText?: string;
  /** Include table of contents */
  includeTableOfContents?: boolean;
  /** Page size for PDF */
  pageSize?: 'A4' | 'Letter' | 'Legal';
  /** Orientation */
  orientation?: 'portrait' | 'landscape';
  /** Language for RTL support */
  language?: string;
  /** Logo URL for professional exports */
  logoUrl?: string;
  /** Workspace name for header */
  workspaceName?: string;
}

export interface BulkExportOptions extends ExportOptions {
  /** Filter by date range */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** Filter by workspace */
  workspaceId?: string;
  /** Filter by user */
  userId?: string;
  /** Specific chat IDs to export */
  chatIds?: string[];
  /** Search filter */
  searchQuery?: string;
}

// =============================================================================
// Export Job Types
// =============================================================================

export interface ExportJob {
  id: string;
  userId: string;
  workspaceId?: string;
  status: ExportStatus;
  format: ExportFormat;
  progress: number;
  currentStep?: string;
  totalItems: number;
  processedItems: number;
  filePath?: string;
  fileSize?: number;
  downloadUrl?: string;
  expiresAt: Date;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
  metadata?: ExportJobMetadata;
}

export interface ExportJobMetadata {
  chatIds?: string[];
  options?: ExportOptions;
  fileName?: string;
  mimeType?: string;
}

// =============================================================================
// Export Result Types
// =============================================================================

export interface ExportResult {
  success: boolean;
  jobId?: string;
  filePath?: string;
  fileSize?: number;
  downloadUrl?: string;
  expiresAt?: Date;
  error?: string;
}

export interface ExportProgress {
  jobId: string;
  status: ExportStatus;
  progress: number;
  currentStep: string;
  processedItems: number;
  totalItems: number;
}

// =============================================================================
// Conversation Data Types
// =============================================================================

export interface ExportConversation {
  id: string;
  title: string;
  messages: ExportMessage[];
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  workspaceId?: string;
  workspaceName?: string;
  userName?: string;
  metadata?: Record<string, unknown>;
}

export interface ExportMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: Date;
  sources?: ExportSource[];
  citations?: ExportCitation[];
  tokensUsed?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
}

export interface ExportSource {
  id: string;
  content: string;
  documentId: string;
  documentName: string;
  page?: number;
  chunkIndex?: number;
  similarity?: number;
}

export interface ExportCitation {
  id: string;
  chunkId: string;
  documentId: string;
  documentName: string;
  page?: number;
  content: string;
  score: number;
}

// =============================================================================
// Template Types
// =============================================================================

export interface PDFTemplateProps {
  conversation: ExportConversation;
  options: ExportOptions;
  citations: ExportCitation[];
}

export interface WordTemplateData {
  conversation: ExportConversation;
  options: ExportOptions;
  citations: ExportCitation[];
}

// =============================================================================
// Storage Types
// =============================================================================

export interface StorageConfig {
  type: 'local' | 's3' | 'r2';
  localPath?: string;
  s3Bucket?: string;
  s3Region?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3Endpoint?: string;
  r2AccountId?: string;
  r2Bucket?: string;
  r2AccessKey?: string;
  r2SecretKey?: string;
}

export interface StoredFile {
  key: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: Date;
  expiresAt: Date;
  url?: string;
}

// =============================================================================
// Citation Formatter Types
// =============================================================================

export interface FormattedCitation {
  id: string;
  inline: string;
  reference: string;
  footnote?: string;
}

export interface CitationFormatter {
  format(citation: ExportCitation, index: number): FormattedCitation;
  formatReferenceList(citations: ExportCitation[]): string[];
}

// =============================================================================
// Event Types
// =============================================================================

export type ExportEventType =
  | 'export:started'
  | 'export:progress'
  | 'export:completed'
  | 'export:failed'
  | 'export:cancelled';

export interface ExportEvent {
  type: ExportEventType;
  jobId: string;
  userId: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}
