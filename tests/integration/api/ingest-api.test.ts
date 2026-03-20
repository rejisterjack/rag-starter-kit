import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/ingest/route';
import { mockNextAuthSession } from '@/tests/utils/helpers/setup';
import { mockPrisma } from '@/tests/utils/mocks/prisma';

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

describe('POST /api/ingest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockFormData = (files: File[]): FormData => {
    const formData = new FormData();
    files.forEach((file, i) => {
      formData.append(`file-${i}`, file);
    });
    formData.append('workspaceId', 'ws-1');
    return formData;
  };

  const createMockRequest = (formData: FormData): Request => {
    return new Request('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: formData,
    });
  };

  it('requires authentication', async () => {
    mockNextAuthSession(null);

    const formData = createMockFormData([
      new File(['test'], 'test.pdf', { type: 'application/pdf' }),
    ]);

    const request = createMockRequest(formData);
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('handles file upload', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const mockCreate = vi.fn().mockResolvedValue({
      id: 'doc-1',
      name: 'test.pdf',
      status: 'processing',
    });
    mockPrisma.document.create = mockCreate;

    vi.mock('@/lib/rag/ingestion', () => ({
      processDocument: vi.fn().mockResolvedValue({
        success: true,
        document: { id: 'doc-1' },
      }),
    }));

    const formData = createMockFormData([
      new File(['test content'], 'test.pdf', { type: 'application/pdf' }),
    ]);

    const request = createMockRequest(formData);
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.documents).toHaveLength(1);
  });

  it('validates file types', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const formData = createMockFormData([
      new File(['test'], 'test.exe', { type: 'application/x-msdownload' }),
    ]);

    const request = createMockRequest(formData);
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors[0]).toContain('file type');
  });

  it('validates file size', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const largeFile = new File(['x'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(largeFile, 'size', { value: 100 * 1024 * 1024 }); // 100MB

    const formData = createMockFormData([largeFile]);

    const request = createMockRequest(formData);
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors[0]).toContain('size');
  });

  it('validates workspace access', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    mockPrisma.membership.findFirst = vi.fn().mockResolvedValue(null);

    const formData = createMockFormData([
      new File(['test'], 'test.pdf', { type: 'application/pdf' }),
    ]);
    formData.set('workspaceId', 'unauthorized-ws');

    const request = createMockRequest(formData);
    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it('handles multiple file uploads', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    vi.mock('@/lib/rag/ingestion', () => ({
      processDocument: vi
        .fn()
        .mockResolvedValueOnce({ success: true, document: { id: 'doc-1' } })
        .mockResolvedValueOnce({ success: true, document: { id: 'doc-2' } }),
    }));

    const formData = createMockFormData([
      new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
      new File(['content2'], 'file2.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    ]);

    const request = createMockRequest(formData);
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.documents).toHaveLength(2);
  });

  it('handles partial failures in batch upload', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    vi.mock('@/lib/rag/ingestion', () => ({
      processDocument: vi
        .fn()
        .mockResolvedValueOnce({ success: true, document: { id: 'doc-1' } })
        .mockResolvedValueOnce({ success: false, error: 'Corrupted file' }),
    }));

    const formData = createMockFormData([
      new File(['valid'], 'valid.pdf', { type: 'application/pdf' }),
      new File(['corrupted'], 'corrupted.pdf', { type: 'application/pdf' }),
    ]);

    const request = createMockRequest(formData);
    const response = await POST(request);

    expect(response.status).toBe(207); // Multi-status
    const body = await response.json();
    expect(body.successful).toHaveLength(1);
    expect(body.failed).toHaveLength(1);
  });

  it('queues background processing for large files', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const mockInngestSend = vi.fn().mockResolvedValue({ ids: ['job-1'] });
    vi.mock('@/lib/inngest', () => ({
      inngest: { send: mockInngestSend },
    }));

    const largeFile = new File(['x'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(largeFile, 'size', { value: 20 * 1024 * 1024 }); // 20MB

    const formData = createMockFormData([largeFile]);

    const request = createMockRequest(formData);
    const response = await POST(request);

    expect(response.status).toBe(202); // Accepted
    expect(mockInngestSend).toHaveBeenCalled();
  });

  it('validates request size limit', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    // Create request that exceeds size limit
    const hugeContent = 'x'.repeat(50 * 1024 * 1024);
    const formData = createMockFormData([
      new File([hugeContent], 'huge.pdf', { type: 'application/pdf' }),
    ]);

    const request = createMockRequest(formData);

    // Would typically fail at middleware level
    const response = await POST(request);
    expect([413, 400]).toContain(response.status);
  });

  it('stores document metadata', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const mockCreate = vi.fn().mockResolvedValue({
      id: 'doc-1',
      name: 'document.pdf',
      status: 'processing',
    });
    mockPrisma.document.create = mockCreate;

    vi.mock('@/lib/rag/ingestion', () => ({
      processDocument: vi.fn().mockResolvedValue({
        success: true,
        document: { id: 'doc-1' },
      }),
    }));

    const formData = createMockFormData([
      new File(['content'], 'document.pdf', { type: 'application/pdf' }),
    ]);
    formData.append('metadata', JSON.stringify({ category: 'financial' }));

    const request = createMockRequest(formData);
    await POST(request);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ category: 'financial' }),
        }),
      })
    );
  });

  it('enforces upload rate limits', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    vi.mock('@/lib/rate-limit', () => ({
      rateLimit: vi.fn().mockResolvedValue({
        success: false,
        limit: 5,
        remaining: 0,
        reset: Date.now() + 3600000,
      }),
    }));

    const formData = createMockFormData([
      new File(['test'], 'test.pdf', { type: 'application/pdf' }),
    ]);

    const request = createMockRequest(formData);
    const response = await POST(request);

    expect(response.status).toBe(429);
  });

  it('returns processing status for async jobs', async () => {
    mockNextAuthSession({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    vi.mock('@/lib/rag/ingestion', () => ({
      processDocument: vi.fn().mockResolvedValue({
        success: true,
        document: { id: 'doc-1', status: 'processing' },
        jobId: 'job-123',
      }),
    }));

    const formData = createMockFormData([
      new File(['content'], 'doc.pdf', { type: 'application/pdf' }),
    ]);

    const request = createMockRequest(formData);
    const response = await POST(request);

    const body = await response.json();
    expect(body.documents[0].status).toBe('processing');
    expect(body.documents[0].jobId).toBe('job-123');
  });
});
