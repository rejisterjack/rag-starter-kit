/**
 * Query Router - Agentic RAG Query Classification
 *
 * Uses few-shot prompting to classify user queries into different types
 * to determine the optimal processing strategy.
 */

import { z } from 'zod';
import { createProviderFromEnv } from '@/lib/ai/llm';

// ============================================================================
// Types
// ============================================================================

export enum QueryType {
  DIRECT_ANSWER = 'direct_answer', // Simple question, no retrieval needed
  RETRIEVE = 'retrieve', // Needs document retrieval
  CALCULATE = 'calculate', // Needs calculation/tool use
  WEB_SEARCH = 'web_search', // Needs web search
  CLARIFY = 'clarify', // Needs user clarification
}

export interface QueryClassification {
  type: QueryType;
  confidence: number;
  reasoning: string;
  suggestedTools?: string[];
}

export interface RouterConfig {
  model?: string;
  temperature?: number;
  fallbackType?: QueryType;
}

// Simple message type for classification (only needs role and content)
export interface SimpleMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ============================================================================
// Classification Schema
// ============================================================================

const ClassificationSchema = z.object({
  type: z.enum([
    QueryType.DIRECT_ANSWER,
    QueryType.RETRIEVE,
    QueryType.CALCULATE,
    QueryType.WEB_SEARCH,
    QueryType.CLARIFY,
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  suggestedTools: z.array(z.string()).optional(),
});

// ============================================================================
// Few-Shot Examples
// ============================================================================

interface FewShotExample {
  query: string;
  history: SimpleMessage[];
  classification: QueryClassification;
}

const fewShotExamples: FewShotExample[] = [
  {
    query: "What's the capital of France?",
    history: [],
    classification: {
      type: QueryType.DIRECT_ANSWER,
      confidence: 0.95,
      reasoning:
        'This is a simple factual question that can be answered directly without document retrieval.',
    },
  },
  {
    query: 'What does the financial report say about Q1 revenue?',
    history: [],
    classification: {
      type: QueryType.RETRIEVE,
      confidence: 0.98,
      reasoning:
        'This query explicitly asks about content from a specific document (financial report).',
      suggestedTools: ['document_search'],
    },
  },
  {
    query: 'Calculate the total if we have 150 units at $45 each with a 15% discount',
    history: [],
    classification: {
      type: QueryType.CALCULATE,
      confidence: 0.97,
      reasoning: 'This requires mathematical calculation with specific numbers.',
      suggestedTools: ['calculator'],
    },
  },
  {
    query: "What's the latest news about OpenAI?",
    history: [],
    classification: {
      type: QueryType.WEB_SEARCH,
      confidence: 0.92,
      reasoning: 'This asks for current information that may not be in the document store.',
      suggestedTools: ['web_search'],
    },
  },
  {
    query: 'What did I ask about earlier?',
    history: [],
    classification: {
      type: QueryType.CLARIFY,
      confidence: 0.85,
      reasoning:
        'This query is vague and refers to unspecified previous context. Need clarification.',
    },
  },
  {
    query: 'Compare Q1 and Q2 performance',
    history: [
      {
        role: 'user',
        content: 'Upload the Q1 financial report',
      },
      {
        role: 'assistant',
        content: 'I have processed the Q1 report. What would you like to know?',
      },
    ],
    classification: {
      type: QueryType.RETRIEVE,
      confidence: 0.88,
      reasoning:
        'This requires retrieving information from uploaded documents and comparing values.',
      suggestedTools: ['document_search', 'calculator'],
    },
  },
  {
    query: 'How much is 25% of the total budget mentioned in the proposal?',
    history: [],
    classification: {
      type: QueryType.RETRIEVE,
      confidence: 0.94,
      reasoning:
        'This requires both document retrieval (to find the budget) and calculation (25%).',
      suggestedTools: ['document_search', 'calculator'],
    },
  },
];

// ============================================================================
// Query Router Implementation
// ============================================================================

export class QueryRouter {
  private config: Required<RouterConfig>;

  constructor(config: RouterConfig = {}) {
    this.config = {
      model: config.model ?? 'gpt-4o-mini',
      temperature: config.temperature ?? 0.1,
      fallbackType: config.fallbackType ?? QueryType.RETRIEVE,
    };
  }

  /**
   * Classify a query to determine the optimal processing strategy
   */
  async classify(query: string, history: SimpleMessage[] = []): Promise<QueryClassification> {
    try {
      const llm = createProviderFromEnv();

      const messages = [
        {
          role: 'system' as const,
          content: this.buildSystemPrompt(),
        },
        ...this.formatFewShotExamples(),
        {
          role: 'user' as const,
          content: this.formatQueryForClassification(query, history),
        },
      ];

      const response = await llm.generate(messages, {
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: 500,
      });

      // Parse the JSON response
      const parsed = this.parseClassificationResponse(response.content);

      return {
        ...parsed,
        // Ensure confidence is within bounds
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
      };
    } catch (error) {
      console.error('Query classification error:', error);

      // Fallback to RETRIEVE if classification fails
      return {
        type: this.config.fallbackType,
        confidence: 0.5,
        reasoning: `Classification failed: ${error instanceof Error ? error.message : 'Unknown error'}. Falling back to ${this.config.fallbackType}.`,
      };
    }
  }

  /**
   * Classify multiple queries in batch (for efficiency)
   */
  async classifyBatch(
    queries: Array<{ query: string; history?: SimpleMessage[] }>
  ): Promise<QueryClassification[]> {
    return Promise.all(queries.map((q) => this.classify(q.query, q.history ?? [])));
  }

  /**
   * Check if query should use RAG (retrieval)
   */
  async shouldUseRAG(query: string, history: SimpleMessage[] = []): Promise<boolean> {
    const classification = await this.classify(query, history);
    return (
      classification.type === QueryType.RETRIEVE || classification.type === QueryType.CALCULATE
    );
  }

  /**
   * Get suggested tools for a query
   */
  async getSuggestedTools(query: string, history: SimpleMessage[] = []): Promise<string[]> {
    const classification = await this.classify(query, history);
    return classification.suggestedTools ?? [];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildSystemPrompt(): string {
    return `You are a query classification expert for a RAG (Retrieval-Augmented Generation) system.
Your task is to analyze user queries and classify them into one of five categories:

1. **direct_answer**: Simple questions that can be answered directly without document retrieval
   - Examples: "What's the capital of France?", "What is 2+2?", "Hello, how are you?"
   
2. **retrieve**: Questions that require searching through uploaded documents
   - Examples: "What does the contract say about payment terms?", "Summarize the annual report"
   
3. **calculate**: Questions requiring mathematical calculations or data processing
   - Examples: "Calculate the total revenue", "What's 15% of $500?", "Compare these two numbers"
   
4. **web_search**: Questions requiring current or external information not in documents
   - Examples: "What's the latest news?", "Current weather in Tokyo", "Who won the game last night?"
   
5. **clarify**: Vague, ambiguous, or incomplete queries that need more information
   - Examples: "What about that?", "Tell me more", "Why?" (without context)

Respond with a JSON object containing:
- type: The classification type
- confidence: A number between 0 and 1
- reasoning: Brief explanation of your classification
- suggestedTools: Array of recommended tools (optional)`;
  }

  private formatFewShotExamples(): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const example of fewShotExamples) {
      messages.push({
        role: 'user',
        content: this.formatQueryForClassification(example.query, example.history),
      });
      messages.push({
        role: 'assistant',
        content: JSON.stringify(example.classification, null, 2),
      });
    }

    return messages;
  }

  private formatQueryForClassification(query: string, history: SimpleMessage[]): string {
    let formatted = `Query: "${query}"`;

    if (history.length > 0) {
      const recentHistory = history.slice(-3);
      const historyText = recentHistory
        .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');
      formatted += `\n\nConversation History:\n${historyText}`;
    }

    return formatted;
  }

  private parseClassificationResponse(content: string): QueryClassification {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return ClassificationSchema.parse(parsed);
      }

      throw new Error('No JSON found in response');
    } catch (error) {
      console.error('Failed to parse classification:', error);

      // Attempt heuristic classification as fallback
      return this.heuristicClassification(content);
    }
  }

  private heuristicClassification(content: string): QueryClassification {
    const lower = content.toLowerCase();

    if (lower.includes('direct_answer')) {
      return {
        type: QueryType.DIRECT_ANSWER,
        confidence: 0.7,
        reasoning: 'Heuristic classification',
      };
    }
    if (lower.includes('retrieve')) {
      return { type: QueryType.RETRIEVE, confidence: 0.7, reasoning: 'Heuristic classification' };
    }
    if (lower.includes('calculate')) {
      return { type: QueryType.CALCULATE, confidence: 0.7, reasoning: 'Heuristic classification' };
    }
    if (lower.includes('web_search')) {
      return { type: QueryType.WEB_SEARCH, confidence: 0.7, reasoning: 'Heuristic classification' };
    }
    if (lower.includes('clarify')) {
      return { type: QueryType.CLARIFY, confidence: 0.7, reasoning: 'Heuristic classification' };
    }

    return {
      type: this.config.fallbackType,
      confidence: 0.5,
      reasoning: 'Could not determine type, using fallback',
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createQueryRouter(config?: RouterConfig): QueryRouter {
  return new QueryRouter(config);
}

/**
 * Quick classification without creating a router instance
 */
export async function classifyQuery(
  query: string,
  history?: SimpleMessage[]
): Promise<QueryClassification> {
  const router = createQueryRouter();
  return router.classify(query, history);
}
