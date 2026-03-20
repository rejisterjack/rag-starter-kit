/**
 * Conversation Memory
 * Manages conversation history with summarization for long conversations
 */

import type { PrismaClient, Message as PrismaMessage } from '@prisma/client';
import { createProviderFromEnv } from '@/lib/ai/llm';
import { buildConversationSummarizationPrompt } from '@/lib/ai/prompts/templates';
import type { Source } from '@/types';

// =============================================================================
// Types
// =============================================================================

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  sources?: Source[];
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface ConversationSummary {
  id: string;
  conversationId: string;
  content: string;
  messageCount: number;
  createdAt: Date;
}

export interface MemoryConfig {
  maxMessages: number;
  maxMessagesBeforeSummarize: number;
  summaryLength: number;
  includeSystemMessages: boolean;
}

const DEFAULT_CONFIG: MemoryConfig = {
  maxMessages: 50,
  maxMessagesBeforeSummarize: 20,
  summaryLength: 200,
  includeSystemMessages: false,
};

// =============================================================================
// Conversation Memory
// =============================================================================

export class ConversationMemory {
  private config: MemoryConfig;
  private llmProvider = createProviderFromEnv();

  constructor(
    private prisma: PrismaClient,
    config?: Partial<MemoryConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get conversation history with optional limit
   */
  async getHistory(conversationId: string, limit?: number): Promise<Message[]> {
    const messages = await this.prisma.message.findMany({
      where: { chatId: conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit ?? this.config.maxMessages,
    });

    return messages.map((m: PrismaMessage) => this.mapPrismaMessage(m));
  }

  /**
   * Get recent messages with optional offset
   */
  async getRecentMessages(
    conversationId: string,
    count: number = 10,
    beforeMessageId?: string
  ): Promise<Message[]> {
    const where: { chatId: string; id?: { lt: string } } = {
      chatId: conversationId,
    };

    if (beforeMessageId) {
      where.id = { lt: beforeMessageId };
    }

    const messages = await this.prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: count,
    });

    // Return in chronological order
    return messages.reverse().map((m: PrismaMessage) => this.mapPrismaMessage(m));
  }

  /**
   * Add a message to the conversation
   */
  async addMessage(
    conversationId: string,
    message: Omit<Message, 'id' | 'createdAt'>
  ): Promise<Message> {
    const created = await this.prisma.message.create({
      data: {
        chatId: conversationId,
        content: message.content,
        role: message.role.toUpperCase() as 'USER' | 'ASSISTANT' | 'SYSTEM',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sources: (message.sources as any) ?? undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tokensUsed: (message.tokensUsed as any) ?? undefined,
      },
    });

    // Check if we need to compress history
    await this.checkAndCompressHistory(conversationId);

    return this.mapPrismaMessage(created);
  }

  /**
   * Add multiple messages at once
   */
  async addMessages(
    conversationId: string,
    messages: Array<Omit<Message, 'id' | 'createdAt'>>
  ): Promise<Message[]> {
    const created = await this.prisma.$transaction(
      messages.map((msg) =>
        this.prisma.message.create({
          data: {
            chatId: conversationId,
            content: msg.content,
            role: msg.role.toUpperCase() as 'USER' | 'ASSISTANT' | 'SYSTEM',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sources: (msg.sources as any) ?? undefined,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tokensUsed: (msg.tokensUsed as any) ?? undefined,
          },
        })
      )
    );

    await this.checkAndCompressHistory(conversationId);

    return created.map((m: PrismaMessage) => this.mapPrismaMessage(m));
  }

  /**
   * Summarize a list of messages
   */
  async summarize(messages: Message[]): Promise<string> {
    if (messages.length === 0) {
      return '';
    }

    const prompt = buildConversationSummarizationPrompt(
      messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      this.config.summaryLength
    );

    try {
      const response = await this.llmProvider.generate(
        [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes conversations accurately.',
          },
          { role: 'user', content: prompt },
        ],
        {
          maxTokens: this.config.summaryLength,
          temperature: 0.3,
        }
      );

      return response.content.trim();
    } catch (error) {
      console.error('Failed to summarize conversation:', error);
      // Fallback: return a simple concatenation of key messages
      return this.fallbackSummarize(messages);
    }
  }

  /**
   * Compress history by summarizing older messages
   */
  async compressHistory(
    conversationId: string,
    maxMessages: number = this.config.maxMessagesBeforeSummarize
  ): Promise<void> {
    const allMessages = await this.prisma.message.findMany({
      where: { chatId: conversationId },
      orderBy: { createdAt: 'asc' },
    });

    if (allMessages.length <= maxMessages) {
      return;
    }

    // Calculate how many messages to summarize
    const messagesToSummarize = allMessages.slice(0, allMessages.length - 10);
    const messagesToKeep = allMessages.slice(-10);

    // Create summary
    const messagesToSummarizeMapped = messagesToSummarize.map((m) => this.mapPrismaMessage(m));
    const summary = await this.summarize(messagesToSummarizeMapped);

    // Delete old messages
    await this.prisma.message.deleteMany({
      where: {
        chatId: conversationId,
        id: {
          in: messagesToSummarize.map((m) => m.id),
        },
      },
    });

    // Insert summary as a system message
    await this.prisma.message.create({
      data: {
        chatId: conversationId,
        content: `[Conversation Summary]: ${summary}`,
        role: 'SYSTEM',
        sources: undefined,
        tokensUsed: undefined,
      },
    });

    console.log(
      `Compressed conversation ${conversationId}: ${allMessages.length} messages -> ${messagesToKeep.length + 1} messages (with summary)`
    );
  }

  /**
   * Get history formatted for LLM context
   * Includes recent messages and summary if available
   */
  async getFormattedHistory(
    conversationId: string,
    maxMessages: number = 10
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const messages = await this.getRecentMessages(conversationId, maxMessages);

    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
  }

  /**
   * Clear conversation history
   */
  async clearHistory(conversationId: string): Promise<void> {
    await this.prisma.message.deleteMany({
      where: { chatId: conversationId },
    });
  }

  /**
   * Get message count for a conversation
   */
  async getMessageCount(conversationId: string): Promise<number> {
    return this.prisma.message.count({
      where: { chatId: conversationId },
    });
  }

  /**
   * Search messages in a conversation
   */
  async searchMessages(conversationId: string, query: string): Promise<Message[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        chatId: conversationId,
        content: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((m: PrismaMessage) => this.mapPrismaMessage(m));
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private mapPrismaMessage(m: PrismaMessage): Message {
    return {
      id: m.id,
      role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
      content: m.content,
      createdAt: m.createdAt,
      sources: m.sources ? (m.sources as unknown as Source[]) : undefined,
      tokensUsed:
        (m.tokensUsed as { prompt: number; completion: number; total: number }) ?? undefined,
    };
  }

  private async checkAndCompressHistory(conversationId: string): Promise<void> {
    const count = await this.getMessageCount(conversationId);

    if (count > this.config.maxMessages) {
      await this.compressHistory(conversationId);
    }
  }

  private fallbackSummarize(messages: Message[]): string {
    // Simple fallback: extract key user queries and assistant responses
    const keyExchanges = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => `${m.role}: ${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`)
      .join('\n');

    return `Key exchanges:\n${keyExchanges}`;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a conversation memory instance
 */
export function createConversationMemory(
  prisma: PrismaClient,
  config?: Partial<MemoryConfig>
): ConversationMemory {
  return new ConversationMemory(prisma, config);
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format messages for LLM context with token limit awareness
 */
export function formatMessagesForContext(
  messages: Message[],
  maxTokens: number = 2000
): Array<{ role: 'user' | 'assistant'; content: string }> {
  // Rough estimate: 4 chars = 1 token
  const maxChars = maxTokens * 4;
  let currentChars = 0;
  const formatted: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Start from most recent
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'system') continue;

    const formattedMsg = {
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    };

    const msgChars = msg.content.length + 20; // Account for formatting

    if (currentChars + msgChars > maxChars && formatted.length > 0) {
      break;
    }

    formatted.unshift(formattedMsg);
    currentChars += msgChars;
  }

  return formatted;
}

/**
 * Extract key facts from conversation history
 */
export function extractKeyFacts(messages: Message[]): string[] {
  const facts: string[] = [];

  for (const msg of messages) {
    // Look for declarative statements in assistant responses
    if (msg.role === 'assistant') {
      // Simple heuristic: sentences that look like facts
      const sentences = msg.content.split(/[.!?]+/);
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        // Look for sentences that likely contain facts
        if (
          trimmed.length > 20 &&
          (trimmed.includes('is') ||
            trimmed.includes('are') ||
            trimmed.includes('was') ||
            trimmed.includes('were') ||
            trimmed.includes('has') ||
            trimmed.includes('have'))
        ) {
          facts.push(trimmed);
        }
      }
    }
  }

  return facts.slice(-10); // Keep last 10 facts
}
