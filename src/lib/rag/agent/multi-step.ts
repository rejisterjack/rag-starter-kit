/**
 * Multi-Step Reasoning for Complex Queries
 *
 * Breaks complex queries into sub-queries, executes each step sequentially,
 * and combines results for a comprehensive final answer.
 *
 * Example: "Compare Q1 and Q2 revenue from the financial report"
 * 1. Retrieve Q1 revenue
 * 2. Retrieve Q2 revenue
 * 3. Calculate difference
 * 4. Generate comparison
 */

import { createProviderFromEnv } from '@/lib/ai/llm';
// import { z } from 'zod';
import type { Message, Source } from '@/types';
import type { Tool } from '../tools/types';
// import type { ReActStep } from './react';

// ============================================================================
// Types
// ============================================================================

export interface SubQuery {
  id: string;
  step: number;
  query: string;
  type: 'retrieve' | 'calculate' | 'compare' | 'summarize' | 'analyze';
  dependsOn?: string[];
  tool?: string;
  toolInput?: Record<string, unknown>;
}

export interface SubQueryResult {
  subQuery: SubQuery;
  result: string;
  sources: Source[];
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface MultiStepResult {
  answer: string;
  subQueries: SubQuery[];
  results: SubQueryResult[];
  sources: Source[];
  reasoning: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  latency: number;
}

export interface MultiStepConfig {
  model?: string;
  temperature?: number;
  maxSubQueries?: number;
  parallelExecution?: boolean;
}

export interface MultiStepContext {
  workspaceId: string;
  userId: string;
  conversationId?: string;
  history?: Message[];
  systemInstructions?: string;
}

// ============================================================================
// Multi-Step Reasoner
// ============================================================================

export class MultiStepReasoner {
  private tools: Map<string, Tool>;
  private config: Required<MultiStepConfig>;

  constructor(tools: Tool[] = [], config: MultiStepConfig = {}) {
    this.tools = new Map(tools.map((t) => [t.name, t]));
    this.config = {
      model: config.model ?? 'gpt-4o-mini',
      temperature: config.temperature ?? 0.2,
      maxSubQueries: config.maxSubQueries ?? 5,
      parallelExecution: config.parallelExecution ?? false,
    };
  }

  /**
   * Execute multi-step reasoning for a complex query
   */
  async execute(query: string, context: MultiStepContext): Promise<MultiStepResult> {
    const startTime = Date.now();
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    // Step 1: Break down the query into sub-queries
    const breakdownResult = await this.breakdownQuery(query, context);
    totalPromptTokens += breakdownResult.usage.promptTokens;
    totalCompletionTokens += breakdownResult.usage.completionTokens;

    const subQueries = breakdownResult.subQueries;

    // Step 2: Execute sub-queries
    const results: SubQueryResult[] = [];

    if (this.config.parallelExecution) {
      // Execute independent sub-queries in parallel
      const executed = new Set<string>();
      const pending = [...subQueries];

      while (pending.length > 0) {
        // Find sub-queries with all dependencies satisfied
        const ready = pending.filter(
          (sq) => !sq.dependsOn || sq.dependsOn.every((dep) => executed.has(dep))
        );

        if (ready.length === 0 && pending.length > 0) {
          // Circular dependency or missing dependency - execute sequentially
          ready.push(pending[0]);
        }

        // Execute ready sub-queries in parallel
        const batchResults = await Promise.all(
          ready.map((sq) => this.executeSubQuery(sq, results, context))
        );

        results.push(...batchResults);
        ready.forEach((sq) => {
          executed.add(sq.id);
          const index = pending.indexOf(sq);
          if (index > -1) pending.splice(index, 1);
        });
      }
    } else {
      // Execute sequentially
      for (const subQuery of subQueries) {
        const result = await this.executeSubQuery(subQuery, results, context);
        results.push(result);
      }
    }

    // Step 3: Combine results into final answer
    const combinationResult = await this.combineResults(query, results, context);
    totalPromptTokens += combinationResult.usage.promptTokens;
    totalCompletionTokens += combinationResult.usage.completionTokens;

    // Collect all sources
    const allSources = this.collectSources(results);

    return {
      answer: combinationResult.answer,
      subQueries,
      results,
      sources: allSources,
      reasoning: combinationResult.reasoning,
      tokensUsed: {
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
        total: totalPromptTokens + totalCompletionTokens,
      },
      latency: Date.now() - startTime,
    };
  }

  /**
   * Stream the multi-step execution
   */
  async *stream(
    query: string,
    context: MultiStepContext
  ): AsyncGenerator<{
    type: 'plan' | 'step' | 'result' | 'answer' | 'error';
    data: unknown;
  }> {
    try {
      // Break down query
      const breakdownResult = await this.breakdownQuery(query, context);
      yield {
        type: 'plan',
        data: { subQueries: breakdownResult.subQueries },
      };

      // Execute sub-queries
      const results: SubQueryResult[] = [];

      for (const subQuery of breakdownResult.subQueries) {
        yield {
          type: 'step',
          data: { step: subQuery.step, query: subQuery.query, type: subQuery.type },
        };

        const result = await this.executeSubQuery(subQuery, results, context);
        results.push(result);

        yield {
          type: 'result',
          data: {
            step: subQuery.step,
            success: result.success,
            result: result.result,
            sources: result.sources.length,
          },
        };
      }

      // Combine results
      const combinationResult = await this.combineResults(query, results, context);

      yield {
        type: 'answer',
        data: {
          answer: combinationResult.answer,
          reasoning: combinationResult.reasoning,
          totalSteps: results.length,
        },
      };
    } catch (error) {
      yield {
        type: 'error',
        data: { message: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async breakdownQuery(
    query: string,
    context: MultiStepContext
  ): Promise<{
    subQueries: SubQuery[];
    usage: { promptTokens: number; completionTokens: number };
  }> {
    const llm = createProviderFromEnv();

    const prompt = `You are a query decomposition expert. Break down complex queries into simple, sequential sub-queries.

Available sub-query types:
- retrieve: Fetch information from documents
- calculate: Perform mathematical operations
- compare: Compare two or more values/items
- summarize: Summarize information
- analyze: Analyze patterns or trends

For each sub-query:
1. Assign a unique ID (e.g., "step1", "step2")
2. Specify dependencies on previous steps if needed
3. Choose appropriate tools if known (document_search, calculator, etc.)

Original Query: "${query}"

Respond with a JSON object containing:
{
  "subQueries": [
    {
      "id": "step1",
      "step": 1,
      "query": "sub-query text",
      "type": "retrieve",
      "dependsOn": [],
      "tool": "document_search",
      "toolInput": { "query": "..." }
    }
  ],
  "reasoning": "Why this breakdown makes sense"
}

Rules:
- Maximum ${this.config.maxSubQueries} sub-queries
- Make each sub-query specific and actionable
- Ensure dependencies form a valid DAG (no cycles)
- Use "dependsOn" to reference IDs of prerequisite steps`;

    const messages = [
      {
        role: 'system' as const,
        content: context.systemInstructions
          ? `${prompt}\n\nContext: ${context.systemInstructions}`
          : prompt,
      },
      {
        role: 'user' as const,
        content: `Break down this query into sub-queries: "${query}"`,
      },
    ];

    const response = await llm.generate(messages, {
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: 1500,
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize sub-queries
      const subQueries: SubQuery[] = (parsed.subQueries || []).map(
        (sq: Partial<SubQuery>, index: number) => ({
          id: sq.id ?? `step${index + 1}`,
          step: sq.step ?? index + 1,
          query: sq.query ?? '',
          type: sq.type ?? 'retrieve',
          dependsOn: sq.dependsOn ?? [],
          tool: sq.tool,
          toolInput: sq.toolInput ?? {},
        })
      );

      return {
        subQueries,
        usage: {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
        },
      };
    } catch (error) {
      console.error('Failed to parse query breakdown:', error);

      // Fallback: single step
      return {
        subQueries: [
          {
            id: 'step1',
            step: 1,
            query,
            type: 'retrieve',
            dependsOn: [],
          },
        ],
        usage: {
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
        },
      };
    }
  }

  private async executeSubQuery(
    subQuery: SubQuery,
    previousResults: SubQueryResult[],
    context: MultiStepContext
  ): Promise<SubQueryResult> {
    const timestamp = new Date();

    try {
      // Substitute any references to previous results
      const resolvedQuery = this.resolveQueryReferences(subQuery.query, previousResults);

      let result: string;
      let sources: Source[] = [];

      // Execute based on type
      switch (subQuery.type) {
        case 'retrieve':
          if (subQuery.tool && this.tools.has(subQuery.tool)) {
            const toolResult = await this.tools.get(subQuery.tool)!.execute({
              ...subQuery.toolInput,
              query: resolvedQuery,
              workspaceId: context.workspaceId,
              userId: context.userId,
            });
            result = toolResult.success
              ? this.formatResult(toolResult.data)
              : `Error: ${toolResult.error}`;
            sources = toolResult.sources ?? [];
          } else {
            // Default retrieval
            const { retrieveSources } = await import('../retrieval');
            const retrieved = await retrieveSources(resolvedQuery, context.userId);
            result = retrieved.map((s) => s.content).join('\n\n');
            sources = retrieved;
          }
          break;

        case 'calculate':
          if (this.tools.has('calculator')) {
            const toolResult = await this.tools.get('calculator')!.execute({
              expression: resolvedQuery,
              ...subQuery.toolInput,
            });
            result = toolResult.success ? String(toolResult.data) : `Error: ${toolResult.error}`;
          } else {
            // Fallback to LLM for simple calculations
            result = await this.calculateWithLLM(resolvedQuery);
          }
          break;

        case 'compare':
          result = await this.performComparison(resolvedQuery, previousResults);
          break;

        case 'summarize':
          result = await this.summarizeWithLLM(resolvedQuery);
          break;

        case 'analyze':
          result = await this.analyzeWithLLM(resolvedQuery, previousResults);
          break;

        default:
          result = `Unsupported sub-query type: ${subQuery.type}`;
      }

      return {
        subQuery,
        result,
        sources,
        success: !result.startsWith('Error'),
        timestamp,
      };
    } catch (error) {
      return {
        subQuery,
        result: '',
        sources: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
      };
    }
  }

  private async combineResults(
    originalQuery: string,
    results: SubQueryResult[],
    context: MultiStepContext
  ): Promise<{
    answer: string;
    reasoning: string;
    usage: { promptTokens: number; completionTokens: number };
  }> {
    const llm = createProviderFromEnv();

    const resultsContext = results
      .map(
        (r) => `Step ${r.subQuery.step} (${r.subQuery.type}): ${r.subQuery.query}
Result: ${r.result}${r.error ? `\nError: ${r.error}` : ''}`
      )
      .join('\n\n---\n\n');

    const prompt = `You are an expert at synthesizing information from multiple sources.

Original Query: "${originalQuery}"

Step-by-step results:
${resultsContext}

Instructions:
1. Synthesize the results into a comprehensive answer
2. Include specific numbers, facts, and details from the results
3. Cite which step provided each piece of information
4. If there were errors, note what information is missing
5. Provide your reasoning for how you combined the results

Respond in this format:
ANSWER: [Your comprehensive answer]
REASONING: [Your reasoning for how you synthesized the results]`;

    const messages = [
      {
        role: 'system' as const,
        content: context.systemInstructions ?? 'You are a helpful assistant.',
      },
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    const response = await llm.generate(messages, {
      model: this.config.model,
      temperature: 0.3,
      maxTokens: 2000,
    });

    const content = response.content;
    const answerMatch = content.match(/ANSWER:\s*(.+?)(?=REASONING:|$)/is);
    const reasoningMatch = content.match(/REASONING:\s*(.+)/is);

    return {
      answer: answerMatch?.[1]?.trim() ?? content.trim(),
      reasoning: reasoningMatch?.[1]?.trim() ?? 'Results combined sequentially',
      usage: {
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
      },
    };
  }

  private resolveQueryReferences(query: string, previousResults: SubQueryResult[]): string {
    // Replace references like {{step1.result}} with actual results
    let resolved = query;
    const referencePattern = /\{\{(\w+)\.?(\w+)?\}\}/g;

    resolved = resolved.replace(referencePattern, (match, stepId, property) => {
      const result = previousResults.find((r) => r.subQuery.id === stepId);
      if (!result) return match;

      if (property === 'result' || !property) {
        return result.result;
      }

      // Try to extract property from result (if JSON)
      try {
        const data = JSON.parse(result.result);
        return String(data[property] ?? match);
      } catch {
        return match;
      }
    });

    return resolved;
  }

  private async calculateWithLLM(expression: string): Promise<string> {
    const llm = createProviderFromEnv();
    const response = await llm.generate(
      [
        {
          role: 'system',
          content:
            'You are a calculator. Evaluate the expression and return ONLY the numerical result.',
        },
        {
          role: 'user',
          content: `Calculate: ${expression}`,
        },
      ],
      { model: this.config.model, temperature: 0 }
    );
    return response.content.trim();
  }

  private async summarizeWithLLM(text: string): Promise<string> {
    const llm = createProviderFromEnv();
    const response = await llm.generate(
      [
        {
          role: 'system',
          content: 'Summarize the following text concisely while preserving key information:',
        },
        {
          role: 'user',
          content: text,
        },
      ],
      { model: this.config.model, temperature: 0.3, maxTokens: 500 }
    );
    return response.content.trim();
  }

  private async performComparison(query: string, results: SubQueryResult[]): Promise<string> {
    const llm = createProviderFromEnv();
    const context = results.map((r) => `${r.subQuery.query}: ${r.result}`).join('\n');

    const response = await llm.generate(
      [
        {
          role: 'system',
          content: 'Compare the items and highlight key differences and similarities:',
        },
        {
          role: 'user',
          content: `Compare based on: ${query}\n\n${context}`,
        },
      ],
      { model: this.config.model, temperature: 0.3, maxTokens: 800 }
    );
    return response.content.trim();
  }

  private async analyzeWithLLM(query: string, results: SubQueryResult[]): Promise<string> {
    const llm = createProviderFromEnv();
    const context = results.map((r) => r.result).join('\n\n');

    const response = await llm.generate(
      [
        {
          role: 'system',
          content: 'Analyze the following data and provide insights:',
        },
        {
          role: 'user',
          content: `Analysis request: ${query}\n\nData:\n${context}`,
        },
      ],
      { model: this.config.model, temperature: 0.3, maxTokens: 1000 }
    );
    return response.content.trim();
  }

  private formatResult(data: unknown): string {
    if (typeof data === 'string') return data;
    if (typeof data === 'number') return String(data);
    if (typeof data === 'boolean') return String(data);
    return JSON.stringify(data, null, 2);
  }

  private collectSources(results: SubQueryResult[]): Source[] {
    const allSources = results.flatMap((r) => r.sources);
    const seen = new Map<string, Source>();

    for (const source of allSources) {
      const key = `${source.metadata.documentId}-${source.metadata.chunkIndex}`;
      if (!seen.has(key)) {
        seen.set(key, source);
      }
    }

    return Array.from(seen.values());
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createMultiStepReasoner(
  tools: Tool[] = [],
  config?: MultiStepConfig
): MultiStepReasoner {
  return new MultiStepReasoner(tools, config);
}
