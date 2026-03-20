/**
 * Token Budget Management
 * Allocates and manages token budgets for context, history, and responses
 */

import type { RetrievedChunk } from './chain';
import type { Message } from './memory';

// =============================================================================
// Types
// =============================================================================

export interface TokenAllocation {
  contextTokens: number;
  historyTokens: number;
  responseTokens: number;
  systemTokens: number;
  reservedTokens: number;
  totalTokens: number;
}

export interface TokenBudget {
  maxTokens: number;
  contextRatio: number;
  historyRatio: number;
  responseRatio: number;
  reservedRatio: number;
}

export interface AllocationResult {
  allocation: TokenAllocation;
  selectedChunks: RetrievedChunk[];
  truncatedHistory: Message[];
  warnings: string[];
}

export interface ModelTokenLimits {
  maxTokens: number;
  maxContextTokens: number;
  reservedForOutput: number;
}

// Token limits for different models (approximate)
export const MODEL_TOKEN_LIMITS: Record<string, ModelTokenLimits> = {
  'gpt-4': {
    maxTokens: 8192,
    maxContextTokens: 8192,
    reservedForOutput: 2000,
  },
  'gpt-4-turbo': {
    maxTokens: 128000,
    maxContextTokens: 128000,
    reservedForOutput: 4096,
  },
  'gpt-4o': {
    maxTokens: 128000,
    maxContextTokens: 128000,
    reservedForOutput: 4096,
  },
  'gpt-4o-mini': {
    maxTokens: 128000,
    maxContextTokens: 128000,
    reservedForOutput: 4096,
  },
  'gpt-3.5-turbo': {
    maxTokens: 16385,
    maxContextTokens: 16385,
    reservedForOutput: 4096,
  },
  llama3: {
    maxTokens: 8192,
    maxContextTokens: 8192,
    reservedForOutput: 2000,
  },
  mistral: {
    maxTokens: 32768,
    maxContextTokens: 32768,
    reservedForOutput: 4096,
  },
  phi3: {
    maxTokens: 128000,
    maxContextTokens: 128000,
    reservedForOutput: 4096,
  },
};

// Default budget allocation ratios (must sum to <= 1.0)
const DEFAULT_BUDGET: TokenBudget = {
  maxTokens: 4000,
  contextRatio: 0.5, // 50% for retrieved context
  historyRatio: 0.2, // 20% for conversation history
  responseRatio: 0.2, // 20% for response generation
  reservedRatio: 0.1, // 10% reserved for overhead
};

// =============================================================================
// Token Budget Manager
// =============================================================================

export class TokenBudgetManager {
  private budget: TokenBudget;

  constructor(budget?: Partial<TokenBudget>) {
    this.budget = { ...DEFAULT_BUDGET, ...budget };
    this.validateBudget();
  }

  /**
   * Allocate token budget between context, history, and response
   */
  allocateBudget(
    maxTokens: number,
    chunks: RetrievedChunk[],
    history: Message[],
    options: {
      systemPrompt?: string;
      modelName?: string;
    } = {}
  ): AllocationResult {
    const warnings: string[] = [];

    // Get model limits
    const modelLimits = this.getModelLimits(options.modelName);
    const effectiveMaxTokens = Math.min(maxTokens, modelLimits.maxContextTokens);

    // Calculate available tokens for input (excluding reserved output)
    const availableTokens = effectiveMaxTokens - modelLimits.reservedForOutput;

    if (availableTokens <= 0) {
      warnings.push('Max tokens too low for model output requirements');
    }

    // Calculate system prompt tokens
    const systemTokens = options.systemPrompt ? estimateTokens(options.systemPrompt) : 200; // Default estimate

    // Remaining tokens after system prompt
    const remainingTokens = Math.max(0, availableTokens - systemTokens);

    // Allocate based on ratios
    const contextTarget = Math.floor(remainingTokens * this.budget.contextRatio);
    const historyTarget = Math.floor(remainingTokens * this.budget.historyRatio);
    const responseTarget = Math.min(
      modelLimits.reservedForOutput,
      Math.floor(remainingTokens * this.budget.responseRatio)
    );

    // Select chunks that fit in context budget
    const { selectedChunks, usedContextTokens } = this.selectChunks(chunks, contextTarget);

    if (selectedChunks.length < chunks.length) {
      warnings.push(
        `Truncated context: ${selectedChunks.length}/${chunks.length} chunks selected due to token limits`
      );
    }

    // Select messages that fit in history budget
    const { truncatedHistory, usedHistoryTokens } = this.selectHistoryMessages(
      history,
      historyTarget
    );

    if (truncatedHistory.length < history.length) {
      warnings.push(
        `Truncated history: ${truncatedHistory.length}/${history.length} messages included`
      );
    }

    // Calculate final allocation
    const allocation: TokenAllocation = {
      contextTokens: usedContextTokens,
      historyTokens: usedHistoryTokens,
      responseTokens: responseTarget,
      systemTokens,
      reservedTokens: modelLimits.reservedForOutput,
      totalTokens:
        systemTokens +
        usedContextTokens +
        usedHistoryTokens +
        responseTarget +
        modelLimits.reservedForOutput,
    };

    return {
      allocation,
      selectedChunks,
      truncatedHistory,
      warnings,
    };
  }

  /**
   * Update budget configuration
   */
  updateBudget(budget: Partial<TokenBudget>): void {
    this.budget = { ...this.budget, ...budget };
    this.validateBudget();
  }

  /**
   * Get recommended max tokens for response based on remaining budget
   */
  getRecommendedMaxResponseTokens(usedInputTokens: number, modelName?: string): number {
    const modelLimits = this.getModelLimits(modelName);
    const available = modelLimits.maxContextTokens - usedInputTokens;

    // Reserve some buffer and don't exceed model's reserved output
    return Math.min(Math.floor(available * 0.9), modelLimits.reservedForOutput);
  }

  /**
   * Check if a request would exceed token budget
   */
  wouldExceedBudget(
    estimatedInputTokens: number,
    requestedOutputTokens: number,
    modelName?: string
  ): {
    wouldExceed: boolean;
    overBy: number;
    suggestion: string;
  } {
    const modelLimits = this.getModelLimits(modelName);
    const total = estimatedInputTokens + requestedOutputTokens;
    const maxAvailable = modelLimits.maxContextTokens;

    const wouldExceed = total > maxAvailable;
    const overBy = wouldExceed ? total - maxAvailable : 0;

    let suggestion = '';
    if (wouldExceed) {
      if (estimatedInputTokens > maxAvailable * 0.6) {
        suggestion = 'Reduce context size by using fewer chunks or shorter history';
      } else {
        suggestion = `Reduce max response tokens to ${maxAvailable - estimatedInputTokens}`;
      }
    }

    return { wouldExceed, overBy, suggestion };
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private validateBudget(): void {
    const total =
      this.budget.contextRatio +
      this.budget.historyRatio +
      this.budget.responseRatio +
      this.budget.reservedRatio;

    if (total > 1.0) {
      throw new Error(`Token budget ratios sum to ${total}, must be <= 1.0`);
    }
  }

  private getModelLimits(modelName?: string): ModelTokenLimits {
    if (!modelName) {
      return MODEL_TOKEN_LIMITS['gpt-4o-mini'];
    }

    // Try exact match first
    if (MODEL_TOKEN_LIMITS[modelName]) {
      return MODEL_TOKEN_LIMITS[modelName];
    }

    // Try prefix match
    for (const [key, limits] of Object.entries(MODEL_TOKEN_LIMITS)) {
      if (modelName.startsWith(key)) {
        return limits;
      }
    }

    // Default fallback
    return MODEL_TOKEN_LIMITS['gpt-4o-mini'];
  }

  private selectChunks(
    chunks: RetrievedChunk[],
    maxTokens: number
  ): {
    selectedChunks: RetrievedChunk[];
    usedContextTokens: number;
  } {
    const selected: RetrievedChunk[] = [];
    let usedTokens = 0;

    // Add overhead for formatting (citation markers, newlines, etc.)
    const formattingOverhead = 50;

    for (const chunk of chunks) {
      const chunkTokens = estimateTokens(chunk.content) + formattingOverhead;

      if (usedTokens + chunkTokens > maxTokens && selected.length > 0) {
        break;
      }

      selected.push(chunk);
      usedTokens += chunkTokens;
    }

    return { selectedChunks: selected, usedContextTokens: usedTokens };
  }

  private selectHistoryMessages(
    messages: Message[],
    maxTokens: number,
    prioritizeRecent: boolean = true
  ): {
    truncatedHistory: Message[];
    usedHistoryTokens: number;
  } {
    const selected: Message[] = [];
    let usedTokens = 0;

    // Add overhead for role markers and formatting
    const formattingOverhead = 10;

    // Start from most recent if prioritizing recent messages
    const messagesToProcess = prioritizeRecent ? [...messages].reverse() : messages;

    for (const message of messagesToProcess) {
      const messageTokens = estimateTokens(message.content) + formattingOverhead;

      if (usedTokens + messageTokens > maxTokens && selected.length > 0) {
        break;
      }

      selected.push(message);
      usedTokens += messageTokens;
    }

    // Reverse back to chronological order if we reversed earlier
    if (prioritizeRecent) {
      selected.reverse();
    }

    return { truncatedHistory: selected, usedHistoryTokens: usedTokens };
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Estimate token count for text
 * Uses a rough approximation: ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Count words and characters for better estimation
  const wordCount = text.trim().split(/\s+/).length;
  const charCount = text.length;

  // Different models have different tokenization, but roughly:
  // - 1 token ≈ 4 characters
  // - 1 token ≈ 0.75 words (for English)
  const estimateFromChars = Math.ceil(charCount / 4);
  const estimateFromWords = Math.ceil(wordCount / 0.75);

  // Use the more conservative estimate
  return Math.max(estimateFromChars, estimateFromWords);
}

/**
 * Estimate tokens for a list of messages
 */
export function estimateMessageTokens(messages: Array<{ role: string; content: string }>): number {
  // Base overhead for the messages array format
  let total = 3;

  for (const message of messages) {
    // Tokens per message: role + content + formatting
    total += estimateTokens(message.content);
    total += 4; // Overhead for role and formatting
  }

  return total;
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const estimated = estimateTokens(text);

  if (estimated <= maxTokens) {
    return text;
  }

  // Rough conversion: tokens * 4 = characters
  const maxChars = maxTokens * 4;
  const truncated = text.slice(0, maxChars);

  // Try to end at a word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Create a token budget manager
 */
export function createTokenBudgetManager(budget?: Partial<TokenBudget>): TokenBudgetManager {
  return new TokenBudgetManager(budget);
}

/**
 * Get token limits for a specific model
 */
export function getModelTokenLimits(modelName: string): ModelTokenLimits {
  return (
    MODEL_TOKEN_LIMITS[modelName] ?? {
      maxTokens: 4096,
      maxContextTokens: 4096,
      reservedForOutput: 1000,
    }
  );
}

/**
 * Validate that a token configuration is valid
 */
export function validateTokenConfig(config: {
  maxTokens?: number;
  contextRatio?: number;
  historyRatio?: number;
  responseRatio?: number;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.maxTokens !== undefined && config.maxTokens < 100) {
    errors.push('maxTokens must be at least 100');
  }

  const totalRatio =
    (config.contextRatio ?? 0) + (config.historyRatio ?? 0) + (config.responseRatio ?? 0);

  if (totalRatio > 1.0) {
    errors.push(`Total ratio ${totalRatio} exceeds 1.0`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate token usage statistics
 */
export function calculateTokenStats(allocations: TokenAllocation[]): {
  totalInputTokens: number;
  totalOutputTokens: number;
  averageContextTokens: number;
  averageHistoryTokens: number;
  maxContextUsed: number;
} {
  const totalInput = allocations.reduce(
    (sum, a) => sum + a.systemTokens + a.contextTokens + a.historyTokens,
    0
  );
  const totalOutput = allocations.reduce((sum, a) => sum + a.responseTokens, 0);
  const avgContext =
    allocations.reduce((sum, a) => sum + a.contextTokens, 0) / allocations.length || 0;
  const avgHistory =
    allocations.reduce((sum, a) => sum + a.historyTokens, 0) / allocations.length || 0;
  const maxContext = Math.max(...allocations.map((a) => a.contextTokens));

  return {
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    averageContextTokens: Math.round(avgContext),
    averageHistoryTokens: Math.round(avgHistory),
    maxContextUsed: maxContext,
  };
}
