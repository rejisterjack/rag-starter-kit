import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/chat/route';
import { mockNextAuthSession } from '@/tests/utils/helpers/setup';
import { mockPrisma } from '@/tests/utils/mocks/prisma';

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

describe('POST /api/chat', () => {
  const createMockRequest = (body: unknown): Request => {
    return new Request('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('requires authentication', async () => {
      mockNextAuthSession(null);

      const request = createMockRequest({
        message: 'Hello',
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 401 for invalid session', async () => {
      mockNextAuthSession(null);

      const request = createMockRequest({
        message: 'Hello',
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('accepts valid session', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Hello'));
          controller.close();
        },
      });

      vi.mock('@/lib/rag/engine', () => ({
        runRAGPipeline: vi.fn().mockResolvedValue({
          stream: mockStream,
          citations: [],
        }),
      }));

      const request = createMockRequest({
        message: 'What is revenue?',
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Request Validation', () => {
    it('validates request body', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const request = createMockRequest({
        // Missing required fields
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('message');
    });

    it('validates workspaceId is present', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const request = createMockRequest({
        message: 'Hello',
        // Missing workspaceId
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('validates message length', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const request = createMockRequest({
        message: 'a'.repeat(10001), // Too long
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('too long');
    });

    it('rejects empty message', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const request = createMockRequest({
        message: '   ',
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Workspace Access', () => {
    it('validates workspace access', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue(null);

      const request = createMockRequest({
        message: 'Hello',
        workspaceId: 'unauthorized-ws',
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain('access');
    });

    it('allows access to member workspace', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({
        id: 'membership-1',
        role: 'member',
        workspaceId: 'ws-1',
      });

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Response'));
          controller.close();
        },
      });

      vi.mock('@/lib/rag/engine', () => ({
        runRAGPipeline: vi.fn().mockResolvedValue({
          stream: mockStream,
          citations: [],
        }),
      }));

      const request = createMockRequest({
        message: 'Hello',
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Streaming Responses', () => {
    it('streams response correctly', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"content": "Hello"}\n\n'));
          controller.close();
        },
      });

      vi.mock('@/lib/rag/engine', () => ({
        runRAGPipeline: vi.fn().mockResolvedValue({
          stream: mockStream,
          citations: [],
        }),
      }));

      const request = createMockRequest({
        message: 'What is the revenue?',
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/plain');
    });

    it('includes citations in response', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

      const mockCitations = [
        { id: 'chunk-1', documentId: 'doc-1', page: 2, content: 'Revenue was $1M' },
        { id: 'chunk-2', documentId: 'doc-1', page: 3, content: 'Growth was 20%' },
      ];

      vi.mock('@/lib/rag/engine', () => ({
        runRAGPipeline: vi.fn().mockResolvedValue({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('Response'));
              controller.close();
            },
          }),
          citations: mockCitations,
        }),
      }));

      const request = createMockRequest({
        message: 'What is the revenue?',
        workspaceId: 'ws-1',
        includeCitations: true,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('RAG with Context', () => {
    it('uses document context when specified', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Based on the document...'));
          controller.close();
        },
      });

      const runRAGPipeline = vi.fn().mockResolvedValue({
        stream: mockStream,
        citations: [{ id: 'chunk-1', documentId: 'doc-1' }],
      });

      vi.mock('@/lib/rag/engine', () => ({
        runRAGPipeline,
      }));

      const request = createMockRequest({
        message: 'What does the document say?',
        workspaceId: 'ws-1',
        documentIds: ['doc-1', 'doc-2'],
      });

      await POST(request);

      expect(runRAGPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          documentIds: ['doc-1', 'doc-2'],
        })
      );
    });

    it('validates document access', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });
      mockPrisma.document.findMany = vi.fn().mockResolvedValue([
        { id: 'doc-1', workspaceId: 'ws-1' },
        // doc-2 is missing - user doesn't have access
      ]);

      const request = createMockRequest({
        message: 'What do the documents say?',
        workspaceId: 'ws-1',
        documentIds: ['doc-1', 'doc-2'],
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
    });
  });

  describe('Conversation History', () => {
    it('handles conversation history', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

      const mockUpdate = vi.fn().mockResolvedValue({});
      mockPrisma.chat.update = mockUpdate;

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Response'));
          controller.close();
        },
      });

      vi.mock('@/lib/rag/engine', () => ({
        runRAGPipeline: vi.fn().mockResolvedValue({
          stream: mockStream,
          citations: [],
        }),
      }));

      const request = createMockRequest({
        message: 'Follow up question',
        workspaceId: 'ws-1',
        chatId: 'chat-1',
        history: [
          { role: 'user', content: 'Previous question' },
          { role: 'assistant', content: 'Previous answer' },
        ],
      });

      await POST(request);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'chat-1' },
        })
      );
    });

    it('creates new chat when chatId not provided', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

      const mockCreate = vi.fn().mockResolvedValue({ id: 'new-chat-123' });
      mockPrisma.chat.create = mockCreate;

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Response'));
          controller.close();
        },
      });

      vi.mock('@/lib/rag/engine', () => ({
        runRAGPipeline: vi.fn().mockResolvedValue({
          stream: mockStream,
          citations: [],
        }),
      }));

      const request = createMockRequest({
        message: 'New question',
        workspaceId: 'ws-1',
      });

      await POST(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            workspaceId: 'ws-1',
          }),
        })
      );
    });
  });

  describe('Rate Limiting', () => {
    it('applies rate limiting', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      // Mock rate limit exceeded
      vi.mock('@/lib/rate-limit', () => ({
        rateLimit: vi.fn().mockResolvedValue({
          success: false,
          limit: 10,
          remaining: 0,
          reset: Date.now() + 60000,
        }),
      }));

      const request = createMockRequest({
        message: 'Hello',
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('includes rate limit headers when allowed', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

      vi.mock('@/lib/rate-limit', () => ({
        rateLimit: vi.fn().mockResolvedValue({
          success: true,
          limit: 50,
          remaining: 45,
          reset: Date.now() + 3600000,
        }),
        addRateLimitHeaders: vi.fn(),
      }));

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Response'));
          controller.close();
        },
      });

      vi.mock('@/lib/rag/engine', () => ({
        runRAGPipeline: vi.fn().mockResolvedValue({
          stream: mockStream,
          citations: [],
        }),
      }));

      const request = createMockRequest({
        message: 'Hello',
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('handles streaming errors gracefully', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

      vi.mock('@/lib/rag/engine', () => ({
        runRAGPipeline: vi.fn().mockRejectedValue(new Error('LLM API error')),
      }));

      const request = createMockRequest({
        message: 'Hello',
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBeDefined();
    });

    it('handles timeout errors', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

      vi.mock('@/lib/rag/engine', () => ({
        runRAGPipeline: vi.fn().mockRejectedValue(new Error('Request timeout')),
      }));

      const request = createMockRequest({
        message: 'Hello',
        workspaceId: 'ws-1',
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('handles invalid JSON in request', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const request = new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Token Usage Tracking', () => {
    it('tracks token usage', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

      const mockCreate = vi.fn().mockResolvedValue({ id: 'usage-1' });
      mockPrisma.tokenUsage.create = mockCreate;

      vi.mock('@/lib/rag/engine', () => ({
        runRAGPipeline: vi.fn().mockResolvedValue({
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('Response'));
              controller.close();
            },
          }),
          citations: [],
          usage: { promptTokens: 150, completionTokens: 50, totalTokens: 200 },
        }),
      }));

      const request = createMockRequest({
        message: 'Hello',
        workspaceId: 'ws-1',
      });

      await POST(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            workspaceId: 'ws-1',
            promptTokens: 150,
            completionTokens: 50,
            totalTokens: 200,
          }),
        })
      );
    });
  });

  describe('Agent Mode', () => {
    it('supports agent mode', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Thinking...'));
          controller.close();
        },
      });

      const runRAGPipeline = vi.fn().mockResolvedValue({
        stream: mockStream,
        citations: [],
        agentSteps: [{ tool: 'search', input: 'query', output: 'results' }],
      });

      vi.mock('@/lib/rag/engine', () => ({
        runRAGPipeline,
      }));

      const request = createMockRequest({
        message: 'Analyze this',
        workspaceId: 'ws-1',
        mode: 'agent',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(runRAGPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'agent',
        })
      );
    });
  });
});
