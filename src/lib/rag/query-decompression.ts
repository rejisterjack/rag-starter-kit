/**
 * Query Decompression for Follow-up Questions
 * Expands short queries based on conversation history for better retrieval
 */

import { createProviderFromEnv } from '@/lib/ai/llm';

export interface QueryDecompressionOptions {
  maxHistoryMessages?: number;
  model?: string;
  temperature?: number;
}

export interface DecompressedQuery {
  originalQuery: string;
  expandedQuery: string;
  standaloneQuery: string;
  requiresContext: boolean;
  confidence: number;
}

export class QueryDecompressor {
  private options: Required<QueryDecompressionOptions>;

  constructor(options: QueryDecompressionOptions = {}) {
    this.options = {
      maxHistoryMessages: options.maxHistoryMessages ?? 5,
      model: options.model ?? 'gpt-4o-mini',
      temperature: options.temperature ?? 0.3,
    };
  }

  /**
   * Check if a query needs decompression
   */
  needsDecompression(query: string): boolean {
    // Short queries
    if (query.length < 20) return true;

    // Queries with pronouns or references
    const referencePatterns = [
      /\b(it|this|that|these|those|they|them|their)\b/i,
      /\b(he|she|his|her|him)\b/i,
      /\b(what|which|who|where|when|why|how)\s+(about|is|was|are|were)\b/i,
      /\b(tell me more|explain|elaborate|expand|clarify)\b/i,
      /\b(continue|go on|proceed)\b/i,
      /\b(above|below|previous|earlier|before|after|next|following)\b/i,
    ];

    return referencePatterns.some((pattern) => pattern.test(query));
  }

  /**
   * Decompress a query using conversation history
   */
  async decompress(
    query: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Promise<DecompressedQuery> {
    // If query doesn't need decompression, return as-is
    if (!this.needsDecompression(query)) {
      return {
        originalQuery: query,
        expandedQuery: query,
        standaloneQuery: query,
        requiresContext: false,
        confidence: 1.0,
      };
    }

    // Get relevant history
    const relevantHistory = history.slice(-this.options.maxHistoryMessages);

    // Build the prompt
    const prompt = this.buildDecompressionPrompt(query, relevantHistory);

    try {
      const llm = createProviderFromEnv();
      const response = await llm.generate(
        [
          {
            role: 'system',
            content: `You are a query expansion specialist. Your task is to transform short or context-dependent queries into standalone, self-contained queries that can be understood without conversation history.

Rules:
1. Replace all pronouns and references with specific entities
2. Include relevant context from the conversation
3. Make the query explicit and unambiguous
4. Preserve the original intent
5. Return ONLY the expanded query, no explanations`,
          },
          { role: 'user', content: prompt },
        ],
        {
          model: this.options.model,
          temperature: this.options.temperature,
          maxTokens: 500,
        }
      );

      const expandedQuery = response.content.trim();
      const confidence = this.calculateConfidence(query, expandedQuery);

      return {
        originalQuery: query,
        expandedQuery,
        standaloneQuery: expandedQuery,
        requiresContext: true,
        confidence,
      };
    } catch (error) {
      console.error('Query decompression failed:', error);
      // Return original on failure
      return {
        originalQuery: query,
        expandedQuery: query,
        standaloneQuery: query,
        requiresContext: false,
        confidence: 0.5,
      };
    }
  }

  /**
   * Build the decompression prompt
   */
  private buildDecompressionPrompt(
    query: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ): string {
    let prompt = 'Conversation History:\n';

    history.forEach((msg, idx) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      prompt += `${idx + 1}. ${role}: ${msg.content}\n`;
    });

    prompt += `\nCurrent Query: "${query}"\n\n`;
    prompt += 'Expand this query into a standalone query that includes all necessary context from the conversation. ';
    prompt += 'Replace pronouns (it, they, this, that) with specific entities. ';
    prompt += 'Make it clear and self-contained.\n\n';
    prompt += 'Expanded Query:';

    return prompt;
  }

  /**
   * Calculate confidence score for the decompression
   */
  private calculateConfidence(original: string, expanded: string): number {
    let score = 0.7; // Base score

    // Longer expansions might have more context
    if (expanded.length > original.length * 1.5) {
      score += 0.1;
    }

    // Check if pronouns were resolved
    const pronouns = /\b(it|this|that|they|them|their|he|she)\b/gi;
    const originalPronouns = (original.match(pronouns) || []).length;
    const expandedPronouns = (expanded.match(pronouns) || []).length;

    if (expandedPronouns < originalPronouns) {
      score += 0.1;
    }

    // Cap at 1.0
    return Math.min(score, 1.0);
  }

  /**
   * Quick decompression without LLM call (rule-based)
   */
  quickDecompress(
    query: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>
  ): DecompressedQuery {
    if (!this.needsDecompression(query) || history.length === 0) {
      return {
        originalQuery: query,
        expandedQuery: query,
        standaloneQuery: query,
        requiresContext: false,
        confidence: 1.0,
      };
    }

    // Get last assistant message for context
    const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant');
    const lastUser = [...history].reverse().find((m) => m.role === 'user');

    let expanded = query;

    // Simple pattern replacements
    const patterns: Record<string, (context: string) => string> = {
      'tell me more': (ctx) => `Tell me more about ${ctx}`,
      'explain': (ctx) => `Explain more about ${ctx}`,
      'elaborate': (ctx) => `Elaborate on ${ctx}`,
      'clarify': (ctx) => `Clarify ${ctx}`,
      'why': (ctx) => `Why ${ctx}`,
      'how': (ctx) => `How ${ctx}`,
      'what about': (ctx) => `What about ${ctx}`,
    };

    const lowerQuery = query.toLowerCase().trim();
    for (const [pattern, replacer] of Object.entries(patterns)) {
      if (lowerQuery.includes(pattern)) {
        const context = lastAssistant?.content.slice(0, 100) || '';
        expanded = replacer(context);
        break;
      }
    }

    return {
      originalQuery: query,
      expandedQuery: expanded,
      standaloneQuery: expanded,
      requiresContext: expanded !== query,
      confidence: 0.6,
    };
  }
}

// Factory function
export function createQueryDecompressor(options?: QueryDecompressionOptions): QueryDecompressor {
  return new QueryDecompressor(options);
}

// Utility function for one-off decompression
export async function decompressQuery(
  query: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  options?: QueryDecompressionOptions
): Promise<DecompressedQuery> {
  const decompressor = createQueryDecompressor(options);
  return decompressor.decompress(query, history);
}

export default QueryDecompressor;
