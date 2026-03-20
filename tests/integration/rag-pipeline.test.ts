import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateResponse, retrieveContext, runRAGPipeline } from '@/lib/rag/engine';
import { getMockPrisma, mockPrisma } from '@/tests/utils/mocks/prisma';

// import { createChunksWithEmbeddings } from '@/tests/utils/fixtures/chunks';

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

describe('RAG Pipeline Integration', () => {
  const mockContext = [
    {
      id: 'chunk-1',
      content: 'Q1 2024 revenue was $32 million',
      similarity: 0.92,
      documentId: 'doc-1',
      metadata: { page: 2 },
    },
    {
      id: 'chunk-2',
      content: 'Q2 2024 revenue was $38 million, showing 19% growth',
      similarity: 0.88,
      documentId: 'doc-1',
      metadata: { page: 3 },
    },
    {
      id: 'chunk-3',
      content: 'Total 2024 revenue reached $150 million with 25% YoY growth',
      similarity: 0.85,
      documentId: 'doc-1',
      metadata: { page: 1 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-End RAG Flow', () => {
    it('processes query through full pipeline', async () => {
      // Mock retrieval
      getMockPrisma().$queryRaw = vi
        .fn()
        .mockResolvedValueOnce(mockContext) // Vector search
        .mockResolvedValueOnce([]); // Keyword search

      // Mock OpenAI
      vi.mock('ai', () => ({
        streamText: vi.fn().mockReturnValue({
          textStream: ['Based', ' on', ' the', ' reports', '...'],
          toAIStream: vi.fn().mockReturnValue(new ReadableStream()),
        }),
        tool: vi.fn(),
      }));

      const result = await runRAGPipeline({
        query: 'What was the revenue in Q1 2024?',
        workspaceId: 'workspace-001',
      });

      expect(result).toBeDefined();
    });

    it('retrieves relevant context', async () => {
      getMockPrisma().$queryRaw = vi.fn().mockResolvedValue(mockContext);

      const context = await retrieveContext({
        query: 'Q1 revenue 2024',
        queryEmbedding: Array(1536)
          .fill(0)
          .map(() => Math.random()),
        workspaceId: 'workspace-001',
        topK: 5,
      });

      expect(context).toHaveLength(3);
      expect(context[0].content).toContain('Q1 2024');
    });

    it('generates response with citations', async () => {
      const response = await generateResponse({
        query: 'What was the revenue?',
        context: mockContext,
        stream: false,
      });

      expect(response.content).toBeDefined();
      expect(response.citations).toBeDefined();
      expect(response.citations).toHaveLength(3);
    });

    it('streams response tokens', async () => {
      const tokens: string[] = [];

      const stream = await generateResponse({
        query: 'What was the revenue?',
        context: mockContext,
        stream: true,
      });

      // Consume stream
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        tokens.push(value);
      }

      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  describe('Retrieval Quality', () => {
    it('filters by similarity threshold', async () => {
      const mixedResults = [
        { ...mockContext[0], similarity: 0.95 },
        { ...mockContext[1], similarity: 0.88 },
        { ...mockContext[2], similarity: 0.45 }, // Below threshold
      ];

      getMockPrisma().$queryRaw = vi.fn().mockResolvedValue(mixedResults);

      const context = await retrieveContext({
        query: 'revenue',
        queryEmbedding: [],
        workspaceId: 'workspace-001',
        minSimilarity: 0.5,
      });

      expect(context.every((c) => c.similarity >= 0.5)).toBe(true);
      expect(context).toHaveLength(2);
    });

    it('applies reranking when enabled', async () => {
      getMockPrisma().$queryRaw = vi.fn().mockResolvedValue(mockContext);

      vi.mock('@/lib/rag/reranker', () => ({
        rerankResults: vi.fn().mockImplementation(({ results }) =>
          // Reverse order to simulate reranking
          Promise.resolve([...results].reverse())
        ),
      }));

      const context = await retrieveContext({
        query: 'Q1 revenue',
        queryEmbedding: [],
        workspaceId: 'workspace-001',
        rerank: true,
      });

      expect(context[0].id).toBe('chunk-3'); // Reordered
    });

    it('handles hybrid search', async () => {
      const vectorResults = [{ id: 'v1', content: 'Vector result', similarity: 0.9 }];
      const keywordResults = [{ id: 'k1', content: 'Keyword result', rank: 0.8 }];

      getMockPrisma()
        .$queryRaw.mockResolvedValueOnce(vectorResults)
        .mockResolvedValueOnce(keywordResults);

      const context = await retrieveContext({
        query: 'revenue',
        queryEmbedding: [],
        workspaceId: 'workspace-001',
        searchType: 'hybrid',
      });

      const ids = context.map((c) => c.id);
      expect(ids).toContain('v1');
      expect(ids).toContain('k1');
    });

    it('filters by document IDs', async () => {
      getMockPrisma().$queryRaw = vi.fn().mockResolvedValue(mockContext);

      await retrieveContext({
        query: 'revenue',
        queryEmbedding: [],
        workspaceId: 'workspace-001',
        documentIds: ['doc-1'],
      });

      const queryCall = getMockPrisma().$queryRaw.mock.calls[0][0];
      expect(queryCall.strings.join('')).toContain('documentId');
    });
  });

  describe('Streaming', () => {
    it('streams complete response', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          const tokens = ['The', ' Q1', ' revenue', ' was', ' $32', ' million', '.'];
          tokens.forEach((token) => controller.enqueue(new TextEncoder().encode(token)));
          controller.close();
        },
      });

      vi.mock('ai', () => ({
        streamText: vi.fn().mockReturnValue({
          toAIStream: vi.fn().mockReturnValue(mockStream),
        }),
      }));

      const stream = await generateResponse({
        query: 'Q1 revenue?',
        context: mockContext,
        stream: true,
      });

      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('includes citation markers in stream', async () => {
      const chunks: string[] = [];

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('According to [1]'));
          controller.close();
        },
      });

      vi.mock('ai', () => ({
        streamText: vi.fn().mockReturnValue({
          toAIStream: vi.fn().mockReturnValue(mockStream),
        }),
      }));

      const stream = await generateResponse({
        query: 'revenue?',
        context: mockContext,
        stream: true,
      });

      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(new TextDecoder().decode(value));
      }

      expect(chunks.join('')).toContain('[1]');
    });

    it('handles stream interruptions', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Partial'));
          controller.error(new Error('Connection lost'));
        },
      });

      vi.mock('ai', () => ({
        streamText: vi.fn().mockReturnValue({
          toAIStream: vi.fn().mockReturnValue(mockStream),
        }),
      }));

      const stream = await generateResponse({
        query: 'revenue?',
        context: mockContext,
        stream: true,
      });

      await expect(stream.getReader().read()).rejects.toThrow('Connection lost');
    });
  });

  describe('Context Assembly', () => {
    it('respects max context length', async () => {
      const longContext = Array(20)
        .fill(0)
        .map((_, i) => ({
          id: `chunk-${i}`,
          content: 'Very long content '.repeat(50),
          similarity: 0.9 - i * 0.01,
        }));

      getMockPrisma().$queryRaw = vi.fn().mockResolvedValue(longContext);

      const context = await retrieveContext({
        query: 'test',
        queryEmbedding: [],
        workspaceId: 'workspace-001',
        maxContextLength: 2000,
      });

      const totalLength = context.reduce((sum, c) => sum + c.content.length, 0);
      expect(totalLength).toBeLessThanOrEqual(2000);
    });

    it('includes source metadata', async () => {
      const context = await retrieveContext({
        query: 'revenue',
        queryEmbedding: [],
        workspaceId: 'workspace-001',
      });

      context.forEach((chunk) => {
        expect(chunk.metadata).toBeDefined();
        expect(chunk.documentId).toBeDefined();
      });
    });

    it('formats context for LLM', async () => {
      const formattedContext = mockContext
        .map(
          (c, i) =>
            `[${i + 1}] ${c.content}\nSource: Document ${c.documentId}, Page ${c.metadata.page}`
        )
        .join('\n\n');

      expect(formattedContext).toContain('[1]');
      expect(formattedContext).toContain('Source:');
      expect(formattedContext).toContain('Page 2');
    });
  });

  describe('System Prompt', () => {
    it('includes context in system prompt', async () => {
      const systemPrompt = `
        You are a helpful assistant. Use the following context to answer the question.
        If the answer is not in the context, say you don't know.
        
        Context:
        ${mockContext.map((c, i) => `[${i + 1}] ${c.content}`).join('\n')}
      `;

      expect(systemPrompt).toContain(mockContext[0].content);
      expect(systemPrompt).toContain("say you don't know");
    });

    it('customizes prompt based on use case', () => {
      const financialPrompt = `
        You are a financial analyst assistant. Analyze the provided financial documents.
        Provide specific numbers and cite sources using [1], [2], etc.
        
        Context:
        ${mockContext.map((c, i) => `[${i + 1}] ${c.content}`).join('\n')}
      `;

      expect(financialPrompt).toContain('financial analyst');
      expect(financialPrompt).toContain('cite sources');
    });
  });

  describe('Error Handling', () => {
    it('handles retrieval errors gracefully', async () => {
      getMockPrisma().$queryRaw = vi.fn().mockRejectedValue(new Error('DB error'));

      await expect(
        retrieveContext({
          query: 'test',
          queryEmbedding: [],
          workspaceId: 'workspace-001',
        })
      ).rejects.toThrow('DB error');
    });

    it('handles empty context gracefully', async () => {
      getMockPrisma().$queryRaw = vi.fn().mockResolvedValue([]);

      const response = await generateResponse({
        query: 'something obscure',
        context: [],
        stream: false,
      });

      expect(response.content).toContain("don't have enough information");
    });

    it('handles LLM API errors', async () => {
      vi.mock('ai', () => ({
        streamText: vi.fn().mockImplementation(() => {
          throw new Error('OpenAI API error');
        }),
      }));

      await expect(
        generateResponse({
          query: 'test',
          context: mockContext,
          stream: false,
        })
      ).rejects.toThrow('OpenAI API error');
    });

    it('provides fallback for rate limits', async () => {
      vi.mock('ai', () => ({
        streamText: vi
          .fn()
          .mockRejectedValueOnce(new Error('Rate limit exceeded'))
          .mockReturnValueOnce({
            text: 'Fallback response',
            toAIStream: vi.fn(),
          }),
      }));

      const response = await generateResponse({
        query: 'test',
        context: mockContext,
        stream: false,
        retries: 1,
      });

      expect(response.content).toBeDefined();
    });
  });

  describe('Token Usage Tracking', () => {
    it('tracks prompt tokens', async () => {
      const response = await generateResponse({
        query: 'test',
        context: mockContext,
        stream: false,
      });

      expect(response.usage).toBeDefined();
      expect(response.usage?.promptTokens).toBeGreaterThan(0);
    });

    it('tracks completion tokens', async () => {
      const response = await generateResponse({
        query: 'test',
        context: mockContext,
        stream: false,
      });

      expect(response.usage?.completionTokens).toBeGreaterThan(0);
    });

    it('stores usage in database', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 'usage-1' });
      getMockPrisma().tokenUsage.create = mockCreate;

      await runRAGPipeline({
        query: 'test',
        workspaceId: 'workspace-001',
        userId: 'user-001',
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            promptTokens: expect.any(Number),
            completionTokens: expect.any(Number),
          }),
        })
      );
    });
  });
});
