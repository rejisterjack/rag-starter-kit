/**
 * OpenAI API Mock
 * 
 * Provides mocks for OpenAI API responses used in RAG pipeline.
 */

import { vi } from 'vitest';

/**
 * Mock OpenAI embedding response
 */
export const mockEmbeddingResponse = {
  object: 'list' as const,
  data: [
    {
      object: 'embedding' as const,
      embedding: Array(1536).fill(0).map(() => Math.random() - 0.5),
      index: 0,
    },
  ],
  model: 'text-embedding-3-small',
  usage: {
    prompt_tokens: 10,
    total_tokens: 10,
  },
};

/**
 * Creates mock embeddings for multiple texts
 */
export const createMockEmbeddings = (count: number, dimension: number = 1536) => {
  return Array(count).fill(0).map((_, i) => ({
    object: 'embedding' as const,
    embedding: Array(dimension).fill(0).map(() => Math.random() - 0.5),
    index: i,
  }));
};

/**
 * Mock chat completion response (non-streaming)
 */
export const mockChatCompletionResponse = {
  id: 'chatcmpl-mock-id',
  object: 'chat.completion' as const,
  created: Date.now(),
  model: 'gpt-4o-mini',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant' as const,
        content: 'This is a mock response from the assistant.',
        refusal: null,
      },
      finish_reason: 'stop' as const,
      logprobs: null,
    },
  ],
  usage: {
    prompt_tokens: 150,
    completion_tokens: 25,
    total_tokens: 175,
  },
  system_fingerprint: 'fp_mock',
};

/**
 * Creates a mock streaming response chunk
 */
export const createMockStreamChunk = (content: string, isLast: boolean = false) => ({
  id: 'chatcmpl-mock-id',
  object: 'chat.completion.chunk' as const,
  created: Date.now(),
  model: 'gpt-4o-mini',
  choices: [
    {
      index: 0,
      delta: {
        role: 'assistant' as const,
        content,
      },
      finish_reason: isLast ? 'stop' as const : null,
      logprobs: null,
    },
  ],
  system_fingerprint: 'fp_mock',
});

/**
 * Mock OpenAI client
 */
export const createMockOpenAIClient = () => {
  return {
    embeddings: {
      create: vi.fn().mockResolvedValue(mockEmbeddingResponse),
    },
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue(mockChatCompletionResponse),
      },
    },
  };
};

/**
 * Mock OpenAI class constructor
 */
export const MockOpenAI = vi.fn().mockImplementation(() => createMockOpenAIClient());

/**
 * Creates a mock streaming iterator for chat completions
 */
export function* mockStreamingResponse(chunks: string[]) {
  for (let i = 0; i < chunks.length; i++) {
    yield createMockStreamChunk(chunks[i], i === chunks.length - 1);
  }
}

/**
 * Async generator version for async iteration
 */
export async function* mockAsyncStreamingResponse(chunks: string[]) {
  for (let i = 0; i < chunks.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 10));
    yield createMockStreamChunk(chunks[i], i === chunks.length - 1);
  }
}

/**
 * Reset all OpenAI mocks
 */
export const resetOpenAIMocks = (): void => {
  vi.clearAllMocks();
};

/**
 * Helper to set up OpenAI mock for embeddings
 */
export const mockEmbeddingsCreate = (
  mockClient: ReturnType<typeof createMockOpenAIClient>,
  embeddings?: number[][]
): void => {
  const response = {
    ...mockEmbeddingResponse,
    data: embeddings 
      ? embeddings.map((embedding, i) => ({
          object: 'embedding' as const,
          embedding,
          index: i,
        }))
      : mockEmbeddingResponse.data,
  };
  mockClient.embeddings.create.mockResolvedValue(response);
};

/**
 * Helper to set up OpenAI mock for chat completions
 */
export const mockChatCompletionsCreate = (
  mockClient: ReturnType<typeof createMockOpenAIClient>,
  response?: string
): void => {
  mockClient.chat.completions.create.mockResolvedValue({
    ...mockChatCompletionResponse,
    choices: [
      {
        ...mockChatCompletionResponse.choices[0],
        message: {
          ...mockChatCompletionResponse.choices[0].message,
          content: response ?? mockChatCompletionResponse.choices[0].message.content,
        },
      },
    ],
  });
};

/**
 * Helper to set up OpenAI mock for streaming chat completions
 */
export const mockStreamingChatCompletionsCreate = (
  mockClient: ReturnType<typeof createMockOpenAIClient>,
  chunks: string[]
): void => {
  mockClient.chat.completions.create.mockResolvedValue(
    mockAsyncStreamingResponse(chunks)
  );
};
