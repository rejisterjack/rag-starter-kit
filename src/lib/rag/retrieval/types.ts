/**
 * Core types for the RAG Retrieval Engine
 * Defines interfaces for retrieval options, filters, strategies, and results
 */

/**
 * Supported distance metrics for vector search
 */
export type DistanceMetric = 'cosine' | 'euclidean' | 'inner_product';

/**
 * Retrieval strategy types
 */
export type RetrievalStrategyType = 'vector' | 'keyword' | 'hybrid' | 'multi-query';

/**
 * Options for retrieval operations
 */
export interface RetrievalOptions {
  /** Workspace/workspace ID for scoping the search */
  workspaceId: string;
  /** The search query */
  query: string;
  /** Maximum number of results to return (default: 5) */
  topK?: number;
  /** Minimum similarity score threshold (0-1, default: 0.7) */
  minScore?: number;
  /** Retrieval strategies to use (default: ['vector']) */
  strategies?: RetrievalStrategy[];
  /** Whether to apply re-ranking (default: false) */
  rerank?: boolean;
  /** Optional filters to apply */
  filters?: RetrievalFilters;
  /** Whether to apply contextual compression (default: false) */
  compress?: boolean;
  /** Whether to expand the query (default: false) */
  expandQuery?: boolean;
}

/**
 * Filters for narrowing down retrieval results
 */
export interface RetrievalFilters {
  /** Filter by specific document IDs */
  documentIds?: string[];
  /** Filter by document types */
  documentTypes?: string[];
  /** Filter by date range */
  dateRange?: { from: Date; to: Date };
  /** Filter by tags */
  tags?: string[];
  /** Filter by user ID (for authorization) */
  userId?: string;
  /** Custom metadata filters */
  metadata?: Record<string, unknown>;
}

/**
 * Individual retrieval strategy configuration
 */
export interface RetrievalStrategy {
  /** Type of retrieval strategy */
  type: RetrievalStrategyType;
  /** Weight for combining results (0-1) */
  weight?: number;
  /** Strategy-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * A retrieved document chunk
 */
export interface RetrievedChunk {
  /** Unique identifier */
  id: string;
  /** Chunk content */
  content: string;
  /** Relevance score */
  score: number;
  /** Chunk metadata */
  metadata: ChunkMetadata;
  /** Method used to retrieve this chunk */
  retrievalMethod: string;
}

/**
 * Metadata for a retrieved chunk
 */
export interface ChunkMetadata {
  /** Parent document ID */
  documentId: string;
  /** Parent document name */
  documentName: string;
  /** Document type */
  documentType: string;
  /** Page number (for paginated documents) */
  page?: number;
  /** Section/heading hierarchy */
  headings?: string[];
  /** Position/index in the document */
  position: number;
  /** Section identifier */
  section?: string;
  /** Character start position */
  start?: number;
  /** Character end position */
  end?: number;
}

/**
 * Result of a retrieval operation
 */
export interface RetrievalResult {
  /** Retrieved chunks */
  chunks: RetrievedChunk[];
  /** Total number of results found */
  totalResults: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Strategies that were used */
  strategiesUsed: string[];
  /** Query that was executed (may be transformed) */
  executedQuery?: string;
  /** Applied filters */
  appliedFilters?: RetrievalFilters;
}

/**
 * Vector search configuration
 */
export interface VectorSearchConfig {
  /** Distance metric for similarity calculation */
  distanceMetric: DistanceMetric;
  /** Whether to use IVF index for large datasets */
  useIVF?: boolean;
  /** Number of probes for IVF search */
  ivfProbes?: number;
  /** Maximum number of candidates for pre-filtering */
  maxCandidates?: number;
}

/**
 * Keyword search configuration
 */
export interface KeywordSearchConfig {
  /** Language for text search (default: 'english') */
  language?: string;
  /** Query parsing method */
  queryType?: 'plain' | 'phrase' | 'websearch';
  /** Whether to highlight matching terms */
  highlight?: boolean;
  /** Highlight start tag */
  highlightStartTag?: string;
  /** Highlight end tag */
  highlightEndTag?: string;
}

/**
 * Hybrid search configuration
 */
export interface HybridSearchConfig {
  /** Weight for vector scores (0-1, default: 0.7) */
  vectorWeight: number;
  /** Weight for keyword scores (0-1, default: 0.3) */
  keywordWeight: number;
  /** RRF constant k (default: 60) */
  rrfK: number;
  /** Whether to normalize scores before fusion */
  normalizeScores: boolean;
}

/**
 * Re-ranking configuration
 */
export interface RerankConfig {
  /** Re-ranking provider */
  provider: 'cohere' | 'local' | 'none';
  /** Model to use for re-ranking */
  model?: string;
  /** Number of results to re-rank */
  topN?: number;
  /** API key for external providers */
  apiKey?: string;
}

/**
 * Query expansion configuration
 */
export interface QueryExpansionConfig {
  /** Number of query variations to generate */
  numVariations: number;
  /** Whether to include the original query */
  includeOriginal: boolean;
  /** Temperature for query generation */
  temperature: number;
}

/**
 * HyDE (Hypothetical Document Embeddings) configuration
 */
export interface HyDEConfig {
  /** Whether to use HyDE expansion */
  enabled: boolean;
  /** Prompt template for generating hypothetical document */
  promptTemplate?: string;
  /** Temperature for generation */
  temperature: number;
}

/**
 * Self-query transformation result
 */
export interface SelfQueryResult {
  /** Transformed query string */
  query: string;
  /** Extracted filters */
  filters: RetrievalFilters;
}

/**
 * Compression configuration
 */
export interface CompressionConfig {
  /** Maximum tokens per compressed chunk */
  maxTokensPerChunk: number;
  /** Whether to preserve sentence boundaries */
  preserveSentences: boolean;
  /** Compression ratio target (0-1) */
  targetRatio: number;
}

/**
 * Retrieved chunk with RRF score
 */
export interface RankedChunk extends RetrievedChunk {
  /** RRF score */
  rrfScore: number;
  /** Original ranks from different strategies */
  originalRanks: Map<string, number>;
}

/**
 * Base retriever interface
 */
export interface BaseRetriever {
  /** Retrieve chunks based on query */
  retrieve(query: string, options: RetrievalOptions): Promise<RetrievedChunk[]>;
  /** Retriever name */
  readonly name: string;
}

/**
 * Preset configurations for different retrieval modes
 */
export interface RetrievalPreset {
  strategies: RetrievalStrategy[];
  rerank: boolean;
  expandQuery: boolean;
  compress: boolean;
  useHyDE: boolean;
  useSelfQuery: boolean;
  config?: {
    vector?: Partial<VectorSearchConfig>;
    keyword?: Partial<KeywordSearchConfig>;
    hybrid?: Partial<HybridSearchConfig>;
    rerank?: Partial<RerankConfig>;
  };
}

/**
 * Map of retrieval presets
 */
export type RetrievalPresets = {
  accuracy: RetrievalPreset;
  speed: RetrievalPreset;
  balanced: RetrievalPreset;
};

/**
 * Search result from raw database query
 */
export interface RawSearchResult {
  id: string;
  documentId: string;
  content: string;
  index: number;
  page: number | null;
  section: string | null;
  documentName: string;
  documentType?: string;
  score: number;
  headings?: string[];
}

/**
 * Options for building SQL filters
 */
export interface FilterBuilderOptions {
  /** Starting parameter index for SQL parameters */
  paramIndex: number;
  /** Array to collect SQL parameters */
  params: unknown[];
}

/**
 * SQL filter result
 */
export interface SQLFilterResult {
  /** WHERE clause SQL */
  whereClause: string;
  /** Updated parameter index */
  paramIndex: number;
  /** Collected parameters */
  params: unknown[];
}
