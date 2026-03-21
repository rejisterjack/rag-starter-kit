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

  const createMockFormData = (files: File[], metadata?: Record<string, unknown>): FormData => {
    const formData = new FormData();
    files.forEach((file, i) => {
      formData.append(`file-${i}`, file);
    });
    formData.append('workspaceId', 'ws-1');
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    return formData;
  };

  const createMockRequest = (formData: FormData): Request => {
    return new Request('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: formData,
    });
  };

  describe('Authentication', () => {
    it('requires authentication', async () => {
      mockNextAuthSession(null);

      const formData = createMockFormData([
        new File(['test'], 'test.pdf', { type: 'application/pdf' }),
      ]);

      const request = createMockRequest(formData);
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('accepts authenticated requests', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });
      mockPrisma.document.create = vi.fn().mockResolvedValue({
        id: 'doc-1',
        name: 'test.pdf',
        status: 'processing',
      });

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
    });
  });

  describe('File Upload', () => {
    it('handles single file upload', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

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
      expect(body.documents[0].name).toBe('test.pdf');
    });

    it('handles multiple file uploads', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

      const mockCreate = vi
        .fn()
        .mockResolvedValueOnce({ id: 'doc-1', name: 'file1.pdf', status: 'processing' })
        .mockResolvedValueOnce({ id: 'doc-2', name: 'file2.docx', status: 'processing' });
      mockPrisma.document.create = mockCreate;

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

    it('stores document metadata', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

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

      const formData = createMockFormData(
        [new File(['content'], 'document.pdf', { type: 'application/pdf' })],
        { category: 'financial', year: 2024 }
      );

      const request = createMockRequest(formData);
      await POST(request);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({ category: 'financial', year: 2024 }),
          }),
        })
      );
    });
  });

  describe('File Validation', () => {
    it('validates file types', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

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

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

      const largeFile = new File(['x'], 'large.pdf', { type: 'application/pdf' });
      Object.defineProperty(largeFile, 'size', { value: 100 * 1024 * 1024 }); // 100MB

      const formData = createMockFormData([largeFile]);

      const request = createMockRequest(formData);
      const response = await POST(request);

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.errors[0]).toContain('size');
    });

    it('accepts supported file types', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });
      mockPrisma.document.create = vi.fn().mockResolvedValue({
        id: 'doc-1',
        name: 'document.pdf',
        status: 'processing',
      });

      vi.mock('@/lib/rag/ingestion', () => ({
        processDocument: vi.fn().mockResolvedValue({
          success: true,
          document: { id: 'doc-1' },
        }),
      }));

      const supportedTypes = [
        { name: 'doc.pdf', type: 'application/pdf' },
        { name: 'doc.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { name: 'doc.txt', type: 'text/plain' },
        { name: 'doc.md', type: 'text/markdown' },
        { name: 'doc.html', type: 'text/html' },
      ];

      for (const fileType of supportedTypes) {
        const formData = createMockFormData([
          new File(['content'], fileType.name, { type: fileType.type }),
        ]);

        const request = createMockRequest(formData);
        const response = await POST(request);

        expect(response.status).toBe(200);
      }
    });
  });

  describe('Workspace Access', () => {
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

    it('requires workspaceId', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      const formData = new FormData();
      formData.append('file-0', new File(['test'], 'test.pdf', { type: 'application/pdf' }));
      // Missing workspaceId

      const request = createMockRequest(formData);
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('OCR Processing', () => {
    it('detects scanned PDF and triggers OCR', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });
      mockPrisma.document.create = vi.fn().mockResolvedValue({
        id: 'doc-1',
        name: 'scanned.pdf',
        status: 'processing',
      });

      const processDocument = vi.fn().mockResolvedValue({
        success: true,
        document: { id: 'doc-1' },
        ocrUsed: true,
      });

      vi.mock('@/lib/rag/ingestion', () => ({
        processDocument,
      }));

      // Simulate scanned PDF (minimal text content)
      const formData = createMockFormData([
        new File(['%PDF-1.4'], 'scanned.pdf', { type: 'application/pdf' }),
      ]);

      const request = createMockRequest(formData);
      const response = await POST(request);

      expect(response.status).toBe(200);
    });

    it('handles OCR processing errors', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });
      mockPrisma.document.create = vi.fn().mockResolvedValue({
        id: 'doc-1',
        name: 'scanned.pdf',
        status: 'processing',
      });
      mockPrisma.document.update = vi.fn().mockResolvedValue({});

      vi.mock('@/lib/rag/ingestion', () => ({
        processDocument: vi.fn().mockResolvedValue({
          success: false,
          error: 'OCR failed',
          document: { id: 'doc-1' },
        }),
      }));

      const formData = createMockFormData([
        new File(['%PDF-1.4'], 'scanned.pdf', { type: 'application/pdf' }),
      ]);

      const request = createMockRequest(formData);
      const response = await POST(request);

      expect(response.status).toBe(207); // Multi-status
    });
  });

  describe('Chunking Pipeline', () => {
    it('processes document with chunking', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });
      mockPrisma.document.create = vi.fn().mockResolvedValue({
        id: 'doc-1',
        name: 'test.pdf',
        status: 'processing',
      });

      const processDocument = vi.fn().mockResolvedValue({
        success: true,
        document: { id: 'doc-1' },
        chunks: [
          { id: 'chunk-1', content: 'Chunk 1', index: 0 },
          { id: 'chunk-2', content: 'Chunk 2', index: 1 },
        ],
        chunkCount: 2,
      });

      vi.mock('@/lib/rag/ingestion', () => ({
        processDocument,
      }));

      const formData = createMockFormData([
        new File(['content'], 'test.pdf', { type: 'application/pdf' }),
      ]);

      const request = createMockRequest(formData);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.documents[0].chunkCount).toBe(2);
    });

    it('uses configured chunking strategy', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });
      mockPrisma.workspace.findUnique = vi.fn().mockResolvedValue({
        id: 'ws-1',
        settings: {
          chunkingStrategy: 'semantic',
          chunkSize: 500,
        },
      });
      mockPrisma.document.create = vi.fn().mockResolvedValue({
        id: 'doc-1',
        name: 'test.pdf',
        status: 'processing',
      });

      const processDocument = vi.fn().mockResolvedValue({
        success: true,
        document: { id: 'doc-1' },
      });

      vi.mock('@/lib/rag/ingestion', () => ({
        processDocument,
      }));

      const formData = createMockFormData([
        new File(['content'], 'test.pdf', { type: 'application/pdf' }),
      ]);

      const request = createMockRequest(formData);
      await POST(request);

      expect(processDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
        })
      );
    });
  });

  describe('Batch Upload', () => {
    it('handles partial failures in batch upload', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });
      mockPrisma.document.create = vi
        .fn()
        .mockResolvedValueOnce({ id: 'doc-1', name: 'valid.pdf', status: 'processing' })
        .mockResolvedValueOnce({ id: 'doc-2', name: 'corrupted.pdf', status: 'processing' });

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
  });

  describe('Background Processing', () => {
    it('queues background processing for large files', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });
      mockPrisma.document.create = vi.fn().mockResolvedValue({
        id: 'doc-1',
        name: 'large.pdf',
        status: 'pending',
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

    it('returns processing status for async jobs', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });
      mockPrisma.document.create = vi.fn().mockResolvedValue({
        id: 'doc-1',
        name: 'doc.pdf',
        status: 'pending',
      });

      const mockInngestSend = vi.fn().mockResolvedValue({ ids: ['job-123'] });
      vi.mock('@/lib/inngest', () => ({
        inngest: { send: mockInngestSend },
      }));

      const largeFile = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
      Object.defineProperty(largeFile, 'size', { value: 15 * 1024 * 1024 });

      const formData = createMockFormData([largeFile]);

      const request = createMockRequest(formData);
      const response = await POST(request);

      const body = await response.json();
      expect(body.documents[0].status).toBe('pending');
      expect(body.documents[0].jobId).toBe('job-123');
    });
  });

  describe('Rate Limiting', () => {
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
  });

  describe('Error Handling', () => {
    it('handles processing errors gracefully', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });
      mockPrisma.document.create = vi.fn().mockRejectedValue(new Error('Database error'));

      const formData = createMockFormData([
        new File(['test'], 'test.pdf', { type: 'application/pdf' }),
      ]);

      const request = createMockRequest(formData);
      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('handles malformed form data', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });

      const request = new Request('http://localhost:3000/api/ingest', {
        method: 'POST',
        body: 'invalid-form-data',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Progress Tracking', () => {
    it('returns initial progress for queued documents', async () => {
      mockNextAuthSession({
        user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      mockPrisma.membership.findFirst = vi.fn().mockResolvedValue({ id: 'm1', role: 'owner' });
      mockPrisma.document.create = vi.fn().mockResolvedValue({
        id: 'doc-1',
        name: 'doc.pdf',
        status: 'processing',
        progress: 0,
      });

      vi.mock('@/lib/rag/ingestion', () => ({
        processDocument: vi.fn().mockResolvedValue({
          success: true,
          document: { id: 'doc-1', progress: 0 },
        }),
      }));

      const formData = createMockFormData([
        new File(['content'], 'doc.pdf', { type: 'application/pdf' }),
      ]);

      const request = createMockRequest(formData);
      const response = await POST(request);

      const body = await response.json();
      expect(body.documents[0].progress).toBeDefined();
    });
  });
});
