import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { processDocument, extractText, chunkDocument, storeEmbeddings } from '@/lib/rag/ingestion';
import { mockPrisma, getMockPrisma, resetPrismaMocks } from '@/tests/utils/mocks/prisma';
import { 
  samplePDFDocument, 
  sampleFinancialReportContent,
  mockPDFFile,
  mockOversizedFile 
} from '@/tests/utils/fixtures/documents';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('pdf-parse', () => ({
  default: vi.fn().mockResolvedValue({
    text: sampleFinancialReportContent,
    numpages: 45,
    info: {
      Author: 'Finance Department',
      Title: 'Annual Financial Report 2024',
    },
  }),
}));

vi.mock('mammoth', () => ({
  extractRawText: vi.fn().mockResolvedValue({
    value: 'Extracted Word document content',
  }),
}));

describe('Document Ingestion Pipeline', () => {
  beforeAll(() => {
    // Setup test database connection if needed
  });

  afterAll(() => {
    // Cleanup
  });

  beforeEach(() => {
    resetPrismaMocks();
    vi.clearAllMocks();
  });

  describe('PDF Processing', () => {
    it('processes PDF successfully', async () => {
      const mockCreate = vi.fn().mockResolvedValue(samplePDFDocument);
      getMockPrisma().document.create = mockCreate;

      const result = await processDocument({
        file: mockPDFFile,
        workspaceId: 'workspace-001',
        userId: 'user-001',
      });

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          name: 'test-document.pdf',
          type: 'application/pdf',
        }),
      }));
    });

    it('extracts text content from PDF', async () => {
      const result = await extractText(mockPDFFile);

      expect(result.text).toContain('Annual Financial Report');
      expect(result.metadata.pages).toBe(45);
      expect(result.metadata.author).toBe('Finance Department');
    });

    it('handles scanned PDFs with OCR', async () => {
      // Mock OCR processing for scanned PDF
      vi.mock('@/lib/ocr', () => ({
        performOCR: vi.fn().mockResolvedValue({
          text: 'OCR extracted text from scanned PDF',
          confidence: 0.95,
        }),
      }));

      const result = await extractText(mockPDFFile, { useOCR: true });

      expect(result.text).toBeDefined();
      expect(result.metadata.ocrConfidence).toBeGreaterThan(0);
    });

    it('validates file type before processing', async () => {
      const { mockInvalidFile } = await import('@/tests/utils/fixtures/documents');
      
      const result = await processDocument({
        file: mockInvalidFile,
        workspaceId: 'workspace-001',
        userId: 'user-001',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('validates file size before processing', async () => {
      const result = await processDocument({
        file: mockOversizedFile,
        workspaceId: 'workspace-001',
        userId: 'user-001',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('size');
    });
  });

  describe('Word Document Processing', () => {
    it('processes DOCX files', async () => {
      const { mockWordFile } = await import('@/tests/utils/fixtures/documents');
      
      const result = await extractText(mockWordFile);

      expect(result.text).toContain('Word document');
      expect(result.metadata).toBeDefined();
    });

    it('extracts document metadata', async () => {
      vi.mocked((await import('mammoth')).extractRawText).mockResolvedValue({
        value: 'Content',
      });

      const { mockWordFile } = await import('@/tests/utils/fixtures/documents');
      const result = await extractText(mockWordFile);

      expect(result.metadata).toBeDefined();
    });
  });

  describe('Text File Processing', () => {
    it('processes plain text files', async () => {
      const textContent = 'Simple text file content\nWith multiple lines.';
      const blob = new Blob([textContent], { type: 'text/plain' });
      const textFile = new File([blob], 'test.txt', { type: 'text/plain' });

      const result = await extractText(textFile);

      expect(result.text).toBe(textContent);
    });

    it('detects encoding', async () => {
      // Test with UTF-8 encoded content
      const utf8Content = 'UTF-8 content: émojis 🎉 résumé';
      const blob = new Blob([utf8Content], { type: 'text/plain; charset=utf-8' });
      const textFile = new File([blob], 'utf8.txt', { type: 'text/plain' });

      const result = await extractText(textFile);

      expect(result.text).toContain('émojis');
    });
  });

  describe('Chunking and Embedding', () => {
    it('chunks and embeds correctly', async () => {
      const mockCreateMany = vi.fn().mockResolvedValue({ count: 5 });
      getMockPrisma().chunk.createMany = mockCreateMany;

      const result = await chunkDocument({
        documentId: 'doc-001',
        text: sampleFinancialReportContent,
        chunkingStrategy: 'recursive',
        chunkSize: 500,
        chunkOverlap: 100,
      });

      expect(result.success).toBe(true);
      expect(result.chunkCount).toBeGreaterThan(0);
    });

    it('uses specified chunking strategy', async () => {
      const chunkSpy = vi.spyOn(await import('@/lib/rag/chunking'), 'recursiveChunking');

      await chunkDocument({
        documentId: 'doc-001',
        text: 'Test content',
        chunkingStrategy: 'recursive',
      });

      expect(chunkSpy).toHaveBeenCalled();
    });

    it('generates embeddings for chunks', async () => {
      const mockCreateMany = vi.fn().mockResolvedValue({ count: 3 });
      getMockPrisma().chunk.createMany = mockCreateMany;

      vi.mock('@/lib/rag/embeddings', () => ({
        generateEmbeddingsBatch: vi.fn().mockResolvedValue([
          Array(1536).fill(0.1),
          Array(1536).fill(0.2),
          Array(1536).fill(0.3),
        ]),
      }));

      const result = await storeEmbeddings({
        documentId: 'doc-001',
        chunks: [
          { content: 'Chunk 1', index: 0 },
          { content: 'Chunk 2', index: 1 },
          { content: 'Chunk 3', index: 2 },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.embeddedCount).toBe(3);
    });

    it('stores metadata with chunks', async () => {
      const mockCreateMany = vi.fn().mockResolvedValue({ count: 1 });
      getMockPrisma().chunk.createMany = mockCreateMany;

      await chunkDocument({
        documentId: 'doc-001',
        text: 'Test',
        metadata: { source: 'test', page: 1 },
      });

      expect(mockCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              metadata: expect.objectContaining({ source: 'test', page: 1 }),
            }),
          ]),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('handles corrupted PDFs gracefully', async () => {
      vi.mocked((await import('pdf-parse')).default).mockRejectedValue(
        new Error('Invalid PDF structure')
      );

      const result = await processDocument({
        file: mockPDFFile,
        workspaceId: 'workspace-001',
        userId: 'user-001',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid PDF');
    });

    it('handles processing timeouts', async () => {
      vi.mocked((await import('pdf-parse')).default).mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const result = await processDocument({
        file: mockPDFFile,
        workspaceId: 'workspace-001',
        userId: 'user-001',
        timeout: 50,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('handles database errors during storage', async () => {
      getMockPrisma().document.create = vi.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await processDocument({
        file: mockPDFFile,
        workspaceId: 'workspace-001',
        userId: 'user-001',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database');
    });

    it('handles embedding generation failures', async () => {
      vi.mock('@/lib/rag/embeddings', () => ({
        generateEmbeddingsBatch: vi.fn().mockRejectedValue(
          new Error('API rate limit exceeded')
        ),
      }));

      const result = await storeEmbeddings({
        documentId: 'doc-001',
        chunks: [{ content: 'Test', index: 0 }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('embedding');
    });

    it('retries failed operations', async () => {
      const mockCreate = vi.fn()
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce(samplePDFDocument);
      
      getMockPrisma().document.create = mockCreate;

      const result = await processDocument({
        file: mockPDFFile,
        workspaceId: 'workspace-001',
        userId: 'user-001',
        retries: 1,
      });

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });
  });

  describe('Background Processing', () => {
    it('queues processing job for large files', async () => {
      const mockInngestSend = vi.fn().mockResolvedValue({ ids: ['job-123'] });
      
      vi.mock('@/lib/inngest', () => ({
        inngest: {
          send: mockInngestSend,
        },
      }));

      await processDocument({
        file: mockOversizedFile,
        workspaceId: 'workspace-001',
        userId: 'user-001',
        background: true,
      });

      expect(mockInngestSend).toHaveBeenCalledWith(expect.objectContaining({
        name: 'document/process',
        data: expect.any(Object),
      }));
    });

    it('tracks processing progress', async () => {
      const mockUpdate = vi.fn();
      getMockPrisma().document.update = mockUpdate;

      await processDocument({
        file: mockPDFFile,
        workspaceId: 'workspace-001',
        userId: 'user-001',
      });

      // Should update status at different stages
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: expect.any(String),
          }),
        })
      );
    });
  });
});
