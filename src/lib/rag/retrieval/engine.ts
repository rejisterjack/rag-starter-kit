/**
 * Main Retrieval Engine
 *
 * Orchestrates all retrieval strategies:
 * - Query expansion (multi-query, HyDE)
 * - Multiple retrieval strategies (vector, keyword, hybrid)
 * - Result fusion (RRF)
 * - Re-ranking
 * - Contextual compression
 * - Self-query transformation
 */

import { generateEmbedding } from '@/lib/ai';
import { ContextualCompressor } from './compression';
import { HybridRetriever, reciprocalRankFusion } from './hybrid';
import { KeywordRetriever } from './keyword';
import {
  getDocumentImages,
  getPageImages,
  type ImageSearchResult,
  type MultiModalSearchResult,
  searchByImage,
  searchImagesByText,
  searchMultiModal,
} from './multimodal';
import { QueryExpander } from './query-expansion';
import { createReranker, diversifyWithMMR } from './reranking';
import { hasMetadataFilters, SelfQueryTransformer } from './self-query';
import type {
  RetrievalFilters,
  RetrievalOptions,
  RetrievalPreset,
  RetrievalResult,
  RetrievalStrategy,
  RetrievedChunk,
} from './types';
import { VectorRetriever } from './vector';

/**
 * Configuration presets for different retrieval modes
 */
export const retrievalPresets = {
  /**
   * Maximum accuracy: Uses hybrid search + multi-query + re-ranking
   * Best for: Complex queries where precision is critical
   * Trade-off: Slower (more LLM calls)
   */
  accuracy: {
    strategies: [{ type: 'hybrid' as const, weight: 1 }],
    rerank: true,
    expandQuery: true,
    compress: true,
    useHyDE: true,
    useSelfQuery: true,
    config: {
      hybrid: { rrfK: 60, vectorWeight: 0.7, keywordWeight: 0.3 },
      rerank: { provider: 'local' as const, topN: 10 },
    },
  },

  /**
   * Maximum speed: Simple vector search only
   * Best for: Simple queries where speed is critical
   * Trade-off: May miss keyword matches
   */
  speed: {
    strategies: [{ type: 'vector' as const, weight: 1 }],
    rerank: false,
    expandQuery: false,
    compress: false,
    useHyDE: false,
    useSelfQuery: false,
    config: {
      vector: { distanceMetric: 'cosine' as const },
    },
  },

  /**
   * Balanced: Hybrid search with re-ranking
   * Best for: General use cases
   * Trade-off: Good balance of speed and accuracy
   */
  balanced: {
    strategies: [{ type: 'hybrid' as const, weight: 1 }],
    rerank: true,
    expandQuery: false,
    compress: false,
    useHyDE: false,
    useSelfQuery: true,
    config: {
      hybrid: { rrfK: 60, vectorWeight: 0.7, keywordWeight: 0.3 },
      rerank: { provider: 'local' as const, topN: 5 },
    },
  },

  /**
   * Keyword-focused: Uses full-text search
   * Best for: Exact phrase matching, keyword-heavy queries
   */
  keyword: {
    strategies: [{ type: 'keyword' as const, weight: 1 }],
    rerank: false,
    expandQuery: false,
    compress: false,
    useHyDE: false,
    useSelfQuery: true,
    config: {
      keyword: { queryType: 'websearch' as const },
    },
  },

  /**
   * Research mode: Multi-query with HyDE
   * Best for: Complex research questions requiring comprehensive coverage
   */
  research: {
    strategies: [
      { type: 'hybrid' as const, weight: 0.6 },
      { type: 'multi-query' as const, weight: 0.4 },
    ],
    rerank: true,
    expandQuery: true,
    compress: true,
    useHyDE: true,
    useSelfQuery: true,
    config: {
      hybrid: { rrfK: 60 },
      rerank: { provider: 'local' as const, topN: 15 },
    },
  },
};

export type RetrievalPresetName = keyof typeof retrievalPresets;

/**
 * Options for the RetrievalEngine
 */
export interface RetrievalEngineOptions {
  /** Default preset to use */
  defaultPreset?: RetrievalPresetName;
  /** Vector retriever configuration */
  vectorConfig?: ConstructorParameters<typeof VectorRetriever>[0];
  /** Keyword retriever configuration */
  keywordConfig?: ConstructorParameters<typeof KeywordRetriever>[0];
  /** Query expander configuration */
  expansionConfig?: ConstructorParameters<typeof QueryExpander>[0];
  /** HyDE configuration */
  hydeConfig?: ConstructorParameters<typeof QueryExpander>[1];
  /** Compression configuration */
  compressionConfig?: ConstructorParameters<typeof ContextualCompressor>[0];
}

/**
 * Main Retrieval Engine class
 */
export class RetrievalEngine {
  private vectorRetriever: VectorRetriever;
  private keywordRetriever: KeywordRetriever;
  private hybridRetriever: HybridRetriever;
  private queryExpander: QueryExpander;
  selfQueryTransformer: SelfQueryTransformer;
  private compressor: ContextualCompressor;
  private defaultPreset: RetrievalPresetName;

  constructor(options: RetrievalEngineOptions = {}) {
    // Initialize retrievers
    this.vectorRetriever = new VectorRetriever(options.vectorConfig);
    this.keywordRetriever = new KeywordRetriever(options.keywordConfig);
    this.hybridRetriever = new HybridRetriever(options.vectorConfig, options.keywordConfig);

    // Initialize transformers
    this.queryExpander = new QueryExpander(options.expansionConfig, options.hydeConfig);
    this.selfQueryTransformer = new SelfQueryTransformer();
    this.compressor = new ContextualCompressor(options.compressionConfig);

    this.defaultPreset = options.defaultPreset ?? 'balanced';
  }

  /**
   * Main retrieval method
   *
   * Pipeline:
   * 1. Self-query transformation (extract filters)
   * 2. Query expansion (if enabled)
   * 3. Run retrieval strategies in parallel
   * 4. Merge results with RRF
   * 5. Re-rank (if enabled)
   * 6. Contextual compression (if enabled)
   * 7. Return final results
   */
  async retrieve(options: RetrievalOptions): Promise<RetrievalResult> {
    const startTime = Date.now();
    const preset = this.getPreset(options);

    let currentQuery = options.query;
    let filters: RetrievalFilters = { ...options.filters };

    // Step 1: Self-query transformation (extract filters from query)
    if (preset.useSelfQuery && hasMetadataFilters(currentQuery)) {
      const transformed = await this.selfQueryTransformer.transform(currentQuery);
      currentQuery = transformed.query || currentQuery;
      filters = { ...filters, ...transformed.filters };
    }

    const updatedOptions: RetrievalOptions = {
      ...options,
      query: currentQuery,
      filters,
    };

    // Step 2 & 3: Query expansion and retrieval
    const allResults: RetrievedChunk[] = [];
    const strategiesUsed: string[] = [];

    for (const strategy of preset.strategies) {
      const strategyResults = await this.executeStrategy(
        strategy,
        currentQuery,
        updatedOptions,
        preset
      );
      allResults.push(...strategyResults);
      strategiesUsed.push(strategy.type);
    }

    // Step 4: Merge results with RRF
    let mergedResults = this.mergeResults(allResults, strategiesUsed);

    // Step 5: Re-rank (if enabled)
    if (preset.rerank && mergedResults.length > 0) {
      const reranker = createReranker(preset.config?.rerank);
      mergedResults = await reranker.rerank(currentQuery, mergedResults);
    }

    // Step 6: Diversify with MMR
    mergedResults = diversifyWithMMR(mergedResults, 0.5, options.topK ?? 5);

    // Step 7: Contextual compression (if enabled)
    if (preset.compress && mergedResults.length > 0) {
      mergedResults = await this.compressor.compress(currentQuery, mergedResults);
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      chunks: mergedResults,
      totalResults: mergedResults.length,
      processingTimeMs,
      strategiesUsed: [...new Set(strategiesUsed)],
      executedQuery: currentQuery,
      appliedFilters: filters,
    };
  }

  /**
   * Execute a single retrieval strategy
   */
  private async executeStrategy(
    strategy: RetrievalStrategy,
    query: string,
    options: RetrievalOptions,
    preset: RetrievalPreset
  ): Promise<RetrievedChunk[]> {
    switch (strategy.type) {
      case 'vector': {
        const embedding = preset.useHyDE
          ? await this.queryExpander.expandHyDE(query)
          : await generateEmbedding(query);
        return this.vectorRetriever.retrieve(embedding, options);
      }

      case 'keyword': {
        return this.keywordRetriever.retrieve(query, options);
      }

      case 'hybrid': {
        return this.hybridRetriever.retrieve(query, options);
      }

      case 'multi-query': {
        return this.executeMultiQueryRetrieval(query, options);
      }

      default:
        return [];
    }
  }

  /**
   * Execute multi-query retrieval
   */
  private async executeMultiQueryRetrieval(
    query: string,
    options: RetrievalOptions
  ): Promise<RetrievedChunk[]> {
    // Generate query variations
    const queries = await this.queryExpander.expandMultiQuery(query);

    // Execute retrieval for each variation
    const results = await Promise.all(
      queries.map(async (q) => {
        const embedding = await generateEmbedding(q);
        return this.vectorRetriever.retrieve(embedding, {
          ...options,
          topK: Math.ceil((options.topK ?? 5) / 2),
        });
      })
    );

    // Flatten and deduplicate
    const seen = new Set<string>();
    const deduplicated: RetrievedChunk[] = [];

    for (const resultList of results) {
      for (const chunk of resultList) {
        if (!seen.has(chunk.id)) {
          seen.add(chunk.id);
          deduplicated.push({
            ...chunk,
            retrievalMethod: 'multi-query',
          });
        }
      }
    }

    return deduplicated;
  }

  /**
   * Merge results from multiple strategies using RRF
   */
  private mergeResults(allResults: RetrievedChunk[], strategiesUsed: string[]): RetrievedChunk[] {
    if (strategiesUsed.length <= 1) {
      return allResults;
    }

    // Group results by strategy
    const resultsByStrategy = new Map<string, RetrievedChunk[]>();

    for (const chunk of allResults) {
      const strategy = chunk.retrievalMethod.split('-')[0];
      const existing = resultsByStrategy.get(strategy) ?? [];
      existing.push(chunk);
      resultsByStrategy.set(strategy, existing);
    }

    // Apply RRF
    const strategyResults = Array.from(resultsByStrategy.values());
    const fused = reciprocalRankFusion(strategyResults, 60);

    return fused.map((ranked) => ({
      id: ranked.id,
      content: ranked.content,
      score: ranked.rrfScore,
      metadata: ranked.metadata,
      retrievalMethod: 'fusion-rrf',
    }));
  }

  /**
   * Get preset configuration
   */
  private getPreset(options: RetrievalOptions): RetrievalPreset {
    // Check if options specify strategies
    if (options.strategies && options.strategies.length > 0) {
      const presetName: RetrievalPresetName =
        options.strategies[0].type === 'vector'
          ? 'speed'
          : options.strategies[0].type === 'keyword'
            ? 'keyword'
            : options.strategies[0].type === 'multi-query'
              ? 'research'
              : 'balanced';
      return retrievalPresets[presetName];
    }

    return retrievalPresets[this.defaultPreset];
  }

  /**
   * Retrieve with a specific preset
   */
  async retrieveWithPreset(
    query: string,
    workspaceId: string,
    presetName: RetrievalPresetName,
    options?: Partial<Omit<RetrievalOptions, 'query' | 'workspaceId'>>
  ): Promise<RetrievalResult> {
    this.defaultPreset = presetName;
    return this.retrieve({
      workspaceId,
      query,
      ...options,
    });
  }

  /**
   * Quick vector search
   */
  async searchVector(query: string, workspaceId: string, topK = 5): Promise<RetrievalResult> {
    const embedding = await generateEmbedding(query);
    const startTime = Date.now();

    const chunks = await this.vectorRetriever.retrieve(embedding, {
      workspaceId,
      query,
      topK,
    });

    return {
      chunks,
      totalResults: chunks.length,
      processingTimeMs: Date.now() - startTime,
      strategiesUsed: ['vector'],
    };
  }

  /**
   * Quick keyword search
   */
  async searchKeyword(query: string, workspaceId: string, topK = 5): Promise<RetrievalResult> {
    const startTime = Date.now();

    const chunks = await this.keywordRetriever.retrieve(query, {
      workspaceId,
      query,
      topK,
    });

    return {
      chunks,
      totalResults: chunks.length,
      processingTimeMs: Date.now() - startTime,
      strategiesUsed: ['keyword'],
    };
  }

  /**
   * Quick hybrid search
   */
  async searchHybrid(query: string, workspaceId: string, topK = 5): Promise<RetrievalResult> {
    const startTime = Date.now();

    const chunks = await this.hybridRetriever.retrieve(query, {
      workspaceId,
      query,
      topK,
    });

    return {
      chunks,
      totalResults: chunks.length,
      processingTimeMs: Date.now() - startTime,
      strategiesUsed: ['hybrid'],
    };
  }

  /**
   * Get available presets
   */
  static getPresets(): typeof retrievalPresets {
    return retrievalPresets;
  }

  /**
   * Update default preset
   */
  setDefaultPreset(preset: RetrievalPresetName): void {
    this.defaultPreset = preset;
  }

  /**
   * Update vector retriever config
   */
  updateVectorConfig(config: Parameters<VectorRetriever['updateConfig']>[0]): void {
    this.vectorRetriever.updateConfig(config);
  }

  /**
   * Update keyword retriever config
   */
  updateKeywordConfig(config: Parameters<KeywordRetriever['updateConfig']>[0]): void {
    this.keywordRetriever.updateConfig(config);
  }

  /**
   * Update query expander config
   */
  updateExpansionConfig(config: Parameters<QueryExpander['updateExpansionConfig']>[0]): void {
    this.queryExpander.updateExpansionConfig(config);
  }

  // ==================== Multi-modal Search Methods ====================

  /**
   * Search for similar images
   * @param imageBuffer - Query image buffer or URL
   * @param workspaceId - Workspace to search in
   * @param topK - Number of results to return
   * @returns Similar images and optionally related document chunks
   */
  async searchByImage(
    imageBuffer: Buffer | string,
    workspaceId: string,
    topK = 5
  ): Promise<MultiModalSearchResult> {
    return searchByImage(imageBuffer, workspaceId, {
      workspaceId,
      query: '',
      topK,
      includeChunks: true,
    });
  }

  /**
   * Search images by text query
   * @param query - Text query
   * @param workspaceId - Workspace to search in
   * @param topK - Number of results to return
   * @returns Matching images and optionally related document chunks
   */
  async searchImagesByText(
    query: string,
    workspaceId: string,
    topK = 5
  ): Promise<MultiModalSearchResult> {
    return searchImagesByText(query, workspaceId, {
      workspaceId,
      query,
      topK,
      includeChunks: true,
    });
  }

  /**
   * Multi-modal search combining text and image
   * @param query - Text query
   * @param imageBuffer - Optional query image
   * @param workspaceId - Workspace to search in
   * @param options - Search options
   * @returns Combined search results
   */
  async searchWithVision(
    query: string,
    imageBuffer: Buffer | string | undefined,
    workspaceId: string,
    options: { topK?: number; imageWeight?: number } = {}
  ): Promise<MultiModalSearchResult> {
    return searchMultiModal(query, imageBuffer, workspaceId, {
      workspaceId,
      query,
      topK: options.topK ?? 5,
      imageWeight: options.imageWeight ?? 0.5,
      includeChunks: true,
    });
  }

  /**
   * Get images for a document
   * @param documentId - Document ID
   * @returns Array of document images
   */
  async getDocumentImages(documentId: string): Promise<ImageSearchResult[]> {
    return getDocumentImages(documentId);
  }

  /**
   * Get images for a specific page
   * @param documentId - Document ID
   * @param pageNumber - Page number
   * @returns Array of page images
   */
  async getPageImages(documentId: string, pageNumber: number): Promise<ImageSearchResult[]> {
    return getPageImages(documentId, pageNumber);
  }
}

/**
 * Create a new RetrievalEngine instance
 */
export function createRetrievalEngine(options?: RetrievalEngineOptions): RetrievalEngine {
  return new RetrievalEngine(options);
}

/**
 * Singleton instance for convenience
 */
let globalEngine: RetrievalEngine | null = null;

export function getRetrievalEngine(options?: RetrievalEngineOptions): RetrievalEngine {
  if (!globalEngine) {
    globalEngine = new RetrievalEngine(options);
  }
  return globalEngine;
}
