/**
 * Core types and interfaces for advanced chunking strategies
 */

/**
 * Represents a single chunk of text with metadata and optional embedding
 */
export interface Chunk {
  /** Unique identifier for the chunk */
  id: string;
  /** The text content of the chunk */
  content: string;
  /** Metadata about the chunk */
  metadata: ChunkMetadata;
  /** Optional embedding vector for the chunk */
  embedding?: number[];
}

/**
 * Metadata associated with a chunk
 */
export interface ChunkMetadata {
  /** Sequential index of the chunk in the document */
  index: number;
  /** Start position in the original document (character offset) */
  start: number;
  /** End position in the original document (character offset) */
  end: number;
  /** Page number (if applicable, e.g., PDFs) */
  page?: number;
  /** Array of headings/sections this chunk belongs to */
  headings?: string[];
  /** Number of tokens in the chunk */
  tokenCount: number;
  /** Parent chunk ID for hierarchical relationships */
  parentId?: string;
  /** Child chunk IDs for hierarchical relationships */
  childIds?: string[];
  /** Document type/section (e.g., 'code', 'paragraph', 'list') */
  sectionType?: string;
  /** Level in hierarchy (0 = root, 1 = child, etc.) */
  level?: number;
}

/**
 * Supported chunking strategies
 */
export type ChunkingStrategy = 'fixed' | 'semantic' | 'hierarchical' | 'late';

/**
 * Options for configuring chunking behavior
 */
export interface ChunkingOptions {
  /** The chunking strategy to use */
  strategy: ChunkingStrategy;
  /** Target chunk size (in characters or tokens depending on implementation) */
  chunkSize?: number;
  /** Overlap between consecutive chunks */
  chunkOverlap?: number;
  /** Separator(s) to use for splitting */
  separator?: string | string[];
  /** Whether to preserve sentence boundaries */
  preserveSentences?: boolean;
  /** Minimum chunk size (smaller chunks are merged or discarded) */
  minChunkSize?: number;
  /** Maximum chunk size (hard limit) */
  maxChunkSize?: number;
  /** For semantic chunking: similarity threshold for boundaries */
  similarityThreshold?: number;
  /** For semantic chunking: embedding function */
  embeddingFunction?: (text: string) => Promise<number[]> | number[];
  /** For hierarchical chunking: levels of hierarchy */
  hierarchicalLevels?: number;
  /** Document ID for chunk identification */
  documentId?: string;
  /** For hierarchical chunking: whether to parse headings */
  parseHeadings?: boolean;
  /** For late chunking: function to get token-level embeddings */
  getTokenEmbeddings?: (text: string) => Promise<number[][]>;
}

/**
 * Profile of a document after analysis
 */
export interface DocumentProfile {
  /** Detected document type */
  type: DocumentType;
  /** Recommended chunking strategy */
  recommendedStrategy: ChunkingStrategy;
  /** Average sentence length in characters */
  avgSentenceLength: number;
  /** Score indicating how well-structured the document is (0-1) */
  structureScore: number;
  /** Estimated token count */
  estimatedTokens: number;
  /** Detected document structure elements */
  structure: DocumentStructure;
  /** Content density score (tokens per character) */
  contentDensity: number;
}

/**
 * Types of documents that can be detected
 */
export type DocumentType = 'technical' | 'legal' | 'narrative' | 'code' | 'academic' | 'general';

/**
 * Structural elements found in a document
 */
export interface DocumentStructure {
  /** Whether the document has headings */
  hasHeadings: boolean;
  /** Number of headings found */
  headingCount: number;
  /** Whether the document has code blocks */
  hasCodeBlocks: boolean;
  /** Whether the document has lists */
  hasLists: boolean;
  /** Whether the document has tables */
  hasTables: boolean;
  /** Average paragraph length */
  avgParagraphLength: number;
  /** Detected headings */
  headings?: string[];
}

/**
 * Statistics about a set of chunks
 */
export interface ChunkStats {
  /** Total number of chunks */
  totalChunks: number;
  /** Average chunk size in characters */
  avgChunkSize: number;
  /** Minimum chunk size */
  minChunkSize: number;
  /** Maximum chunk size */
  maxChunkSize: number;
  /** Total estimated tokens */
  estimatedTokens: number;
  /** Average tokens per chunk */
  avgTokensPerChunk: number;
  /** Distribution of chunk sizes */
  sizeDistribution: SizeDistribution;
}

/**
 * Distribution of chunk sizes
 */
export interface SizeDistribution {
  /** Number of small chunks (< 100 chars) */
  small: number;
  /** Number of medium chunks (100-500 chars) */
  medium: number;
  /** Number of large chunks (500-1000 chars) */
  large: number;
  /** Number of extra large chunks (> 1000 chars) */
  extraLarge: number;
}

/**
 * Token count information
 */
export interface TokenCount {
  /** Total tokens */
  total: number;
  /** Tokens per chunk (if applicable) */
  perChunk?: number[];
  /** Whether the count is estimated (not exact) */
  isEstimated: boolean;
}

/**
 * Interface for document analyzers
 */
export interface DocumentAnalyzer {
  analyze(content: string): DocumentProfile;
}

/**
 * Base interface for all chunkers
 */
export interface Chunker {
  /** Chunk the given document */
  chunk(document: string, options: ChunkingOptions): Promise<Chunk[]>;
  /** Get chunker name */
  getName(): string;
  /** Validate options */
  validateOptions(options: ChunkingOptions): boolean;
}

/**
 * Options for semantic chunking
 */
export interface SemanticChunkingOptions extends ChunkingOptions {
  strategy: 'semantic';
  /** Similarity threshold for creating new chunk boundaries (0-1) */
  similarityThreshold: number;
  /** Minimum similarity to consider sentences related */
  minSimilarity: number;
  /** Function to generate embeddings */
  embeddingFunction: (text: string) => Promise<number[]> | number[];
  /** Window size for comparing sentences */
  windowSize: number;
}

/**
 * Options for hierarchical chunking
 */
export interface HierarchicalChunkingOptions extends ChunkingOptions {
  strategy: 'hierarchical';
  /** Chunk sizes for each level */
  levelSizes: number[];
  /** Overlaps for each level */
  levelOverlaps?: number[];
  /** Parse headings for structure */
  parseHeadings: boolean;
  /** Heading patterns to recognize */
  headingPatterns?: RegExp[];
}

/**
 * Options for late chunking
 */
export interface LateChunkingOptions extends ChunkingOptions {
  strategy: 'late';
  /** Model with large context window for embeddings */
  embeddingModel: string;
  /** Context window size */
  contextWindow: number;
  /** Function to get token-level embeddings */
  getTokenEmbeddings: (text: string) => Promise<number[][]>;
  /** Window size for averaging */
  windowSize: number;
  /** Stride for sliding window */
  stride: number;
}

/**
 * Options for fixed-size chunking
 */
export interface FixedChunkingOptions extends ChunkingOptions {
  strategy: 'fixed';
  /** Whether to use character or token-based splitting */
  splitBy: 'character' | 'token';
  /** Separators in priority order */
  separators: string[];
  /** Keep separator at start of chunk */
  keepSeparator: 'start' | 'end' | false;
}

/**
 * Error types for chunking operations
 */
export class ChunkingError extends Error {
  constructor(
    message: string,
    public readonly code: ChunkingErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ChunkingError';
  }
}

/**
 * Error codes for chunking operations
 */
export type ChunkingErrorCode =
  | 'INVALID_OPTIONS'
  | 'EMPTY_DOCUMENT'
  | 'EMBEDDING_FAILED'
  | 'TOKEN_COUNT_FAILED'
  | 'INVALID_STRATEGY'
  | 'HIERARCHY_ERROR'
  | 'LATE_CHUNKING_ERROR';
