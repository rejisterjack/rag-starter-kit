/**
 * Query Expansion Techniques
 *
 * Implements advanced query expansion methods:
 * - Multi-Query Expansion: Generate variations of the original query
 * - HyDE (Hypothetical Document Embeddings): Generate hypothetical answer for better retrieval
 * - Sub-query Decomposition: Break complex queries into simpler sub-queries
 */

import { generateChatCompletion, generateEmbedding } from '@/lib/ai';
import type { HyDEConfig, QueryExpansionConfig } from './types';

/**
 * Default configuration for query expansion
 */
export const defaultQueryExpansionConfig: QueryExpansionConfig = {
  numVariations: 3,
  includeOriginal: true,
  temperature: 0.7,
};

/**
 * Default configuration for HyDE
 */
export const defaultHyDEConfig: HyDEConfig = {
  enabled: true,
  temperature: 0.5,
  promptTemplate: `You are an expert at retrieving relevant documents. 
Given the user's question, write a hypothetical document that would perfectly answer this question.
The document should be detailed, factual, and contain all the information needed to answer the query.

User Query: {query}

Hypothetical Document:`,
};

/**
 * Prompt template for multi-query expansion
 */
const MULTI_QUERY_PROMPT = `You are an expert at information retrieval. Your task is to generate {num_variations} different variations of the given user query.
These variations should:
- Capture different phrasings and wordings
- Include potential synonyms
- Cover different aspects of the query
- Be semantically equivalent but lexically diverse

Original Query: {query}

Generate {num_variations} variations (one per line, without numbering):`;

/**
 * Prompt template for sub-query decomposition
 */
const SUB_QUERY_PROMPT = `You are an expert at breaking down complex questions. 
Analyze the user's query and break it down into 2-4 simpler sub-queries that together would answer the original question.
Each sub-query should focus on a specific aspect or piece of information needed.

Original Query: {query}

Sub-queries (one per line, without numbering):`;

// Message type for AI completions
interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

/**
 * Query Expander class
 * Implements multiple query expansion techniques
 */
export class QueryExpander {
  private expansionConfig: QueryExpansionConfig;
  private hydeConfig: HyDEConfig;

  constructor(expansionConfig?: Partial<QueryExpansionConfig>, hydeConfig?: Partial<HyDEConfig>) {
    this.expansionConfig = { ...defaultQueryExpansionConfig, ...expansionConfig };
    this.hydeConfig = { ...defaultHyDEConfig, ...hydeConfig };
  }

  /**
   * Generate multiple query variations using an LLM
   *
   * @param query - Original user query
   * @returns Array of query variations including original (if configured)
   */
  async expandMultiQuery(query: string): Promise<string[]> {
    const prompt = MULTI_QUERY_PROMPT.replace('{query}', query).replace(
      /{num_variations}/g,
      String(this.expansionConfig.numVariations)
    );

    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content:
            'You are a helpful assistant that generates query variations for better document retrieval.',
        },
        { role: 'user', content: prompt },
      ];

      const { text } = await generateChatCompletion(
        messages as unknown as Parameters<typeof generateChatCompletion>[0],
        { temperature: this.expansionConfig.temperature }
      );

      // Parse variations from response
      const variations = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.replace(/^\d+\.\s*/, '')) // Remove numbering
        .slice(0, this.expansionConfig.numVariations);

      // Include original if configured
      if (this.expansionConfig.includeOriginal) {
        return [query, ...variations];
      }

      return variations;
    } catch (error) {
      console.error('[QueryExpander] Multi-query expansion failed:', error);
      // Fallback to original query
      return [query];
    }
  }

  /**
   * Generate variations without LLM (fallback method)
   * Uses simple heuristics like synonym replacement and word reordering
   */
  expandMultiQueryFallback(query: string): string[] {
    const variations: string[] = [query];

    // Simple transformations
    const transformations = [
      // Remove question words
      (q: string) =>
        q.replace(/^(what is|what are|how to|how do|why is|why are|when is|when are)\s+/i, ''),
      // Add "information about"
      (q: string) => `information about ${q.replace(/^(what is|what are)\s+/i, '')}`,
      // Add "details on"
      (q: string) => `details on ${q.replace(/^(what is|what are)\s+/i, '')}`,
    ];

    for (const transform of transformations) {
      const variation = transform(query);
      if (variation !== query && !variations.includes(variation)) {
        variations.push(variation);
      }
    }

    return variations.slice(0, this.expansionConfig.numVariations + 1);
  }

  /**
   * HyDE (Hypothetical Document Embeddings) expansion
   *
   * Generates a hypothetical document that would answer the query,
   * then returns the embedding of that document for vector search.
   *
   * @param query - Original user query
   * @returns Embedding of the hypothetical document
   */
  async expandHyDE(query: string): Promise<number[]> {
    if (!this.hydeConfig.enabled) {
      // Return regular query embedding if HyDE is disabled
      return generateEmbedding(query);
    }

    const promptTemplate = this.hydeConfig.promptTemplate ?? defaultHyDEConfig.promptTemplate;
    if (!promptTemplate) {
      return generateEmbedding(query);
    }

    const prompt = promptTemplate.replace('{query}', query);

    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert at writing detailed, factual documents.',
        },
        { role: 'user', content: prompt },
      ];

      const { text: hypotheticalDoc } = await generateChatCompletion(
        messages as unknown as Parameters<typeof generateChatCompletion>[0],
        { temperature: this.hydeConfig.temperature, maxTokens: 500 }
      );

      console.log(
        '[QueryExpander] HyDE generated document:',
        hypotheticalDoc.slice(0, 100) + '...'
      );

      // Generate embedding for the hypothetical document
      return generateEmbedding(hypotheticalDoc);
    } catch (error) {
      console.error('[QueryExpander] HyDE expansion failed:', error);
      // Fallback to regular query embedding
      return generateEmbedding(query);
    }
  }

  /**
   * Generate hypothetical document text (without embedding)
   *
   * @param query - Original user query
   * @returns Hypothetical document text
   */
  async generateHypotheticalDocument(query: string): Promise<string> {
    const promptTemplate = this.hydeConfig.promptTemplate ?? defaultHyDEConfig.promptTemplate;
    if (!promptTemplate) {
      return query;
    }

    const prompt = promptTemplate.replace('{query}', query);

    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert at writing detailed, factual documents.',
        },
        { role: 'user', content: prompt },
      ];

      const { text } = await generateChatCompletion(
        messages as unknown as Parameters<typeof generateChatCompletion>[0],
        { temperature: this.hydeConfig.temperature, maxTokens: 500 }
      );

      return text;
    } catch (error) {
      console.error('[QueryExpander] HyDE document generation failed:', error);
      return query;
    }
  }

  /**
   * Sub-query decomposition
   * Breaks complex queries into simpler sub-queries
   *
   * @param query - Original user query
   * @returns Array of sub-queries
   */
  async expandSubQueries(query: string): Promise<string[]> {
    const prompt = SUB_QUERY_PROMPT.replace('{query}', query);

    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert at breaking down complex questions into simpler parts.',
        },
        { role: 'user', content: prompt },
      ];

      const { text } = await generateChatCompletion(
        messages as unknown as Parameters<typeof generateChatCompletion>[0],
        { temperature: 0.5 }
      );

      // Parse sub-queries from response
      const subQueries = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => line.replace(/^\d+\.\s*/, '')) // Remove numbering
        .slice(0, 4); // Max 4 sub-queries

      // Always include original query
      return [query, ...subQueries];
    } catch (error) {
      console.error('[QueryExpander] Sub-query decomposition failed:', error);
      return [query];
    }
  }

  /**
   * Combine all expansion techniques
   * Returns multiple query variations and optionally HyDE embeddings
   */
  async expandAll(query: string): Promise<{
    queries: string[];
    hydeEmbedding?: number[];
    subQueries: string[];
  }> {
    const [multiQueries, hydeEmbedding, subQueries] = await Promise.all([
      this.expandMultiQuery(query),
      this.expandHyDE(query).catch((err: Error) => {
        console.error('HyDE expansion failed:', err);
        return undefined;
      }),
      this.expandSubQueries(query),
    ]);

    // Combine and deduplicate
    const allQueries = [...new Set([...multiQueries, ...subQueries])];

    return {
      queries: allQueries,
      hydeEmbedding,
      subQueries,
    };
  }

  /**
   * Update expansion configuration
   */
  updateExpansionConfig(config: Partial<QueryExpansionConfig>): void {
    this.expansionConfig = { ...this.expansionConfig, ...config };
  }

  /**
   * Update HyDE configuration
   */
  updateHyDEConfig(config: Partial<HyDEConfig>): void {
    this.hydeConfig = { ...this.hydeConfig, ...config };
  }
}

/**
 * Convenience function for multi-query expansion
 */
export async function expandMultiQuery(
  query: string,
  config?: Partial<QueryExpansionConfig>
): Promise<string[]> {
  const expander = new QueryExpander(config);
  return expander.expandMultiQuery(query);
}

/**
 * Convenience function for HyDE expansion
 */
export async function expandHyDE(query: string, config?: Partial<HyDEConfig>): Promise<number[]> {
  const expander = new QueryExpander(undefined, config);
  return expander.expandHyDE(query);
}

/**
 * Convenience function for sub-query decomposition
 */
export async function expandSubQueries(query: string): Promise<string[]> {
  const expander = new QueryExpander();
  return expander.expandSubQueries(query);
}

/**
 * Merge and deduplicate results from multiple queries
 * Uses a simple content similarity check
 */
export function mergeQueryResults<T extends { id: string; content: string }>(
  resultsList: T[][]
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const results of resultsList) {
    for (const result of results) {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        merged.push(result);
      }
    }
  }

  return merged;
}
