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
  workspaceId?: string;
  config?: Partial<RAGConfig>;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
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

// =============================================================================
// Web Speech API Types
// =============================================================================

/**
 * Supported languages for speech recognition and synthesis
 */
export type SupportedLanguage =
  | 'en-US'
  | 'en-GB'
  | 'en-AU'
  | 'en-CA'
  | 'en-IN'
  | 'es-ES'
  | 'es-MX'
  | 'es-AR'
  | 'fr-FR'
  | 'fr-CA'
  | 'de-DE'
  | 'de-AT'
  | 'de-CH'
  | 'it-IT'
  | 'pt-BR'
  | 'pt-PT'
  | 'nl-NL'
  | 'pl-PL'
  | 'ru-RU'
  | 'ja-JP'
  | 'ko-KR'
  | 'zh-CN'
  | 'zh-TW'
  | 'zh-HK'
  | 'ar-SA'
  | 'ar-AE'
  | 'ar-EG'
  | 'hi-IN'
  | 'th-TH'
  | 'vi-VN'
  | 'tr-TR'
  | 'id-ID'
  | 'auto';

/**
 * Speech recognition configuration options
 */
export interface SpeechRecognitionOptions {
  /** Language code (e.g., 'en-US') */
  language?: SupportedLanguage;
  /** Enable continuous listening */
  continuous?: boolean;
  /** Return interim results */
  interimResults?: boolean;
  /** Maximum alternatives per result */
  maxAlternatives?: number;
  /** Enable automatic language detection */
  autoDetectLanguage?: boolean;
}

/**
 * Speech recognition error types
 */
export type SpeechRecognitionErrorType =
  | 'no-speech'
  | 'aborted'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported'
  | 'unknown';

/**
 * Speech recognition error
 */
export interface SpeechRecognitionError {
  type: SpeechRecognitionErrorType;
  message: string;
}

/**
 * Speech recognition result alternative
 */
export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

/**
 * Speech recognition result
 */
export interface SpeechRecognitionResult {
  isFinal: boolean;
  alternatives: SpeechRecognitionAlternative[];
  transcript: string;
  confidence: number;
  [index: number]: SpeechRecognitionAlternative;
}

/**
 * Speech recognition result list
 */
export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

/**
 * Speech recognition event
 */
export interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

/**
 * Speech recognition error event
 */
export interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

/**
 * Speech recognition instance
 */
export interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onnomatch: (() => void) | null;
  onaudiostart: (() => void) | null;
  onaudioend: (() => void) | null;
  onsoundstart: (() => void) | null;
  onsoundend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

/**
 * Voice information for speech synthesis
 */
export interface TTSVoice {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
  gender?: 'male' | 'female' | 'neutral';
}

/**
 * Text-to-speech configuration options
 */
export interface TTSSynthesisOptions {
  /** Voice to use for synthesis */
  voice?: TTSVoice;
  /** Speech rate (0.1 to 10, default 1) */
  rate?: number;
  /** Speech pitch (0 to 2, default 1) */
  pitch?: number;
  /** Speech volume (0 to 1, default 1) */
  volume?: number;
  /** Language code */
  lang?: SupportedLanguage;
}

/**
 * Voice command handler function
 */
export type VoiceCommandHandler = (args?: string) => void;

/**
 * Voice command definition
 */
export interface VoiceCommand {
  /** Command identifier */
  id: string;
  /** Phrases that trigger this command */
  phrases: string[];
  /** Handler function */
  handler: VoiceCommandHandler;
  /** Whether command requires confirmation */
  requiresConfirmation?: boolean;
  /** Description for help/feedback */
  description: string;
}

/**
 * Audio level data for visualization
 */
export interface AudioLevelData {
  /** Current volume level (0-1) */
  level: number;
  /** Frequency data for visualization */
  frequencyData?: Uint8Array;
  /** Whether audio is currently detected */
  isSpeaking: boolean;
}

// Extend Window interface for Web Speech API
declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    SpeechGrammarList?: new () => SpeechGrammarListInstance;
    webkitSpeechGrammarList?: new () => SpeechGrammarListInstance;
  }

  interface SpeechGrammarListInstance {
    addFromString(grammar: string, weight: number): void;
    length: number;
  }

  interface SpeechRecognitionEvent {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionErrorEvent {
    error: string;
    message: string;
  }
}
