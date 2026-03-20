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

  it('streams response correctly', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    // Mock the streaming response
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

  it('tracks token usage', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const mockCreate = vi.fn().mockResolvedValue({ id: 'usage-1' });
    mockPrisma.tokenUsage.create = mockCreate;

    // Mock successful response
    vi.mock('@/lib/rag/engine', () => ({
      runRAGPipeline: vi.fn().mockResolvedValue({
        stream: new ReadableStream(),
        citations: [],
        usage: { promptTokens: 150, completionTokens: 50 },
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
        }),
      })
    );
  });

  it('handles streaming errors gracefully', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

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

  it('includes citations in response', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const mockCitations = [
      { id: 'chunk-1', documentId: 'doc-1', page: 2 },
      { id: 'chunk-2', documentId: 'doc-1', page: 3 },
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
    // Citations should be in response headers or stream
  });

  it('handles conversation history', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const mockUpdate = vi.fn().mockResolvedValue({});
    mockPrisma.chat.update = mockUpdate;

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
});
