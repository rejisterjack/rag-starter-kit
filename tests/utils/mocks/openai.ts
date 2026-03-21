/**
 * OpenAI Mock for Testing
 *
 * Mock implementation of OpenAI API for unit and integration tests.
 */

import { vi } from 'vitest';

// Mock OpenAI responses
export const mockOpenAIResponses = {
  chatCompletion: {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-4o-mini',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: 'This is a test response from the mock OpenAI API.',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  },
  streamingChunk: {
    id: 'chatcmpl-test',
    object: 'chat.completion.chunk',
    created: Date.now(),
    model: 'gpt-4o-mini',
    choices: [
      {
        index: 0,
        delta: {
          content: 'Test chunk',
        },
        finish_reason: null,
      },
    ],
  },
  embedding: {
    object: 'list',
    data: [
      {
        object: 'embedding',
        index: 0,
        embedding: Array(1536)
          .fill(0)
          .map(() => Math.random() - 0.5),
      },
    ],
    model: 'text-embedding-3-small',
    usage: {
      prompt_tokens: 10,
      total_tokens: 10,
    },
  },
};

// Mock OpenAI client
export const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
  embeddings: {
    create: vi.fn(),
  },
};

// Reset all OpenAI mocks
export function resetOpenAIMocks() {
  mockOpenAI.chat.completions.create.mockReset();
  mockOpenAI.embeddings.create.mockReset();

  // Set default mock returns
  mockOpenAI.chat.completions.create.mockResolvedValue(mockOpenAIResponses.chatCompletion);
  mockOpenAI.embeddings.create.mockResolvedValue(mockOpenAIResponses.embedding);
}

// Setup streaming mock
export function setupStreamingMock(chunks: string[] = ['Test', ' response', ' from', ' stream']) {
  const streamChunks = chunks.map((content, index) => ({
    ...mockOpenAIResponses.streamingChunk,
    choices: [
      {
        ...mockOpenAIResponses.streamingChunk.choices[0],
        delta: { content },
        finish_reason: index === chunks.length - 1 ? 'stop' : null,
      },
    ],
  }));

  mockOpenAI.chat.completions.create.mockResolvedValue(createAsyncIterable(streamChunks));
}

// Helper to create async iterable
function createAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const item of items) {
        yield item;
      }
    },
  };
}

// Mock OpenAI module
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => mockOpenAI),
}));

// Mock AI SDK
vi.mock('ai', () => ({
  streamText: vi.fn(),
  generateText: vi.fn(),
  embed: vi.fn(),
  embedMany: vi.fn(),
}));
