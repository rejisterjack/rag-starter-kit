/**
 * Core types for the RAG Chatbot application
 */

// =============================================================================
// User & Authentication Types
// =============================================================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  user: User;
  expires: string;
}

// =============================================================================
// Chat Types
// =============================================================================

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: Date;
  chatId: string;
  sources?: Source[];
}

export interface Chat {
  id: string;
  title: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
}

export interface Source {
  id: string;
  content: string;
  metadata: SourceMetadata;
  similarity?: number;
}

export interface SourceMetadata {
  documentId: string;
  documentName: string;
  page?: number;
  chunkIndex: number;
  totalChunks: number;
}

// =============================================================================
// Document Types
// =============================================================================

export interface Document {
  id: string;
  name: string;
  contentType: DocumentType;
  size: number;
  status: DocumentStatus;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  chunkCount: number;
  metadata?: DocumentMetadata;
}

export type DocumentType = 'PDF' | 'DOCX' | 'TXT' | 'MD' | 'HTML';

export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface DocumentMetadata {
  title?: string;
  author?: string;
  pageCount?: number;
  wordCount?: number;
  sourceUrl?: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  metadata: ChunkMetadata;
  index: number;
}

export interface ChunkMetadata {
  start: number;
  end: number;
  page?: number;
  section?: string;
}

// =============================================================================
// RAG Engine Types
// =============================================================================

export interface RAGConfig {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  temperature: number;
  maxTokens: number;
  model: string;
  embeddingModel: string;
  /** Filter results by document IDs */
  filter?: {
    documentIds?: string[];
  };
  /** Enable reranking of results */
  rerank?: boolean;
  /** Maximum sources per document */
  maxSourcesPerDocument?: number;
  /** Cache TTL in seconds */
  cacheTtl?: number;
  /** Maximum context length for LLM */
  maxContextLength?: number;
  /** Custom system instructions */
  systemInstructions?: string;
}

export interface RAGQuery {
  query: string;
  chatId?: string;
  userId?: string;
  config?: Partial<RAGConfig>;
}

export interface RAGResponse {
  answer: string;
  sources: Source[];
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  latency: number;
}

// =============================================================================
// API Types
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// =============================================================================
// Ingestion Types
// =============================================================================

export interface IngestionJob {
  id: string;
  documentId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface IngestionOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  batchSize?: number;
  extractImages?: boolean;
  preserveFormatting?: boolean;
}

// =============================================================================
// UI Types
// =============================================================================

export interface Theme {
  mode: 'light' | 'dark' | 'system';
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

// =============================================================================
// Utility Types
// =============================================================================

export type Nullable<T> = T | null;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

// =============================================================================
// Database Types (Prisma-generated types should be used in production)
// =============================================================================

export interface DatabaseConnection {
  url: string;
  pooling?: boolean;
}

export interface VectorSearchResult {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  index: number;
  page: number | null;
  section: string | null;
  similarity: number;
}
