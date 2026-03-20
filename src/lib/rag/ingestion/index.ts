/**
 * Document Ingestion Pipeline
 *
 * Processes documents through parsing, chunking, embedding, and vector storage.
 * Now integrated with the new embedding providers and vector store.
 */

import { createEmbeddingProviderFromEnv } from '@/lib/ai/embeddings';
import { batchInsertChunks, prisma, validateChunks } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createChunks } from '@/lib/rag/chunking';
import type { DocumentType, IngestionOptions } from '@/types';
import { parseHTML as parseHTMLContent } from './parsers/html';

// ============================================================================
// Document Parsing
// ============================================================================

/**
 * Parse PDF buffer to text
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import for pdf-parse
    const pdfModule = await import('pdf-parse');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parseFn = (
      pdfModule as unknown as { default: (buffer: Buffer) => Promise<{ text: string }> }
    ).default;
    const data = await parseFn(buffer);
    return data.text;
  } catch (error) {
    logger.error('PDF parsing error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw new Error('Failed to parse PDF file');
  }
}

/**
 * Parse DOCX buffer to text
 */
export async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import for mammoth
    const mammothModule = await import('mammoth');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mammoth = mammothModule as unknown as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    logger.error('DOCX parsing error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw new Error('Failed to parse DOCX file');
  }
}

/**
 * Parse HTML to text
 */
export async function parseHTML(buffer: Buffer): Promise<string> {
  try {
    const parsed = parseHTMLContent(buffer);
    return parsed.text;
  } catch (error) {
    logger.error('HTML parsing error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw new Error('Failed to parse HTML file');
  }
}

/**
 * Parse TXT/MD buffer to text
 */
export function parseText(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

/**
 * Detect document type from filename
 */
export function detectDocumentType(filename: string): DocumentType {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'pdf':
      return 'PDF';
    case 'docx':
      return 'DOCX';
    case 'html':
    case 'htm':
      return 'HTML';
    case 'md':
      return 'MD';
    case 'txt':
    default:
      return 'TXT';
  }
}

/**
 * Parse document based on type
 */
export async function parseDocument(buffer: Buffer, type: DocumentType): Promise<string> {
  switch (type) {
    case 'PDF':
      return parsePDF(buffer);
    case 'DOCX':
      return parseDOCX(buffer);
    case 'HTML':
      return parseHTML(buffer);
    case 'MD':
    case 'TXT':
    default:
      return parseText(buffer);
  }
}

// ============================================================================
// Document Processing with Embeddings
// ============================================================================

/**
 * Process a document: parse, chunk, generate embeddings, and store vectors
 *
 * This is the main ingestion pipeline that:
 * 1. Parses the document based on type
 * 2. Chunks the content using recursive text splitter
 * 3. Generates embeddings using the configured provider
 * 4. Stores chunks with embeddings in the vector database
 * 5. Handles partial failures gracefully
 */
export async function processDocument(
  documentId: string,
  options: IngestionOptions = {}
): Promise<void> {
  const startTime = Date.now();

  // Initialize embedding provider and vector store
  const embeddingProvider = createEmbeddingProviderFromEnv();
  // const vectorStore = createVectorStore(prisma);

  try {
    // Get document from database
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    if (!document.content) {
      throw new Error(`Document has no content: ${documentId}`);
    }

    // const userId = document.userId;

    // Update document status
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    // Update ingestion job if exists
    const ingestionJob = await prisma.ingestionJob.findUnique({
      where: { documentId },
    });

    if (ingestionJob) {
      await prisma.ingestionJob.update({
        where: { id: ingestionJob.id },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
          progress: 10,
        },
      });
    }

    // Step 1: Create chunks
    logger.info(`Creating chunks for document`, { documentId });
    const chunks = await createChunks(documentId, document.content, {
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
    });

    logger.info(`Created chunks`, { documentId, count: chunks.length });

    if (ingestionJob) {
      await prisma.ingestionJob.update({
        where: { id: ingestionJob.id },
        data: { progress: 30 },
      });
    }

    // Step 2: Generate embeddings in batches
    logger.info(`Generating embeddings`, { documentId, chunkCount: chunks.length });

    const chunkTexts = chunks.map((c) => c.content);
    let embeddings: number[][];

    try {
      embeddings = await embeddingProvider.embedDocuments(chunkTexts);
    } catch (error) {
      logger.error('Embedding generation failed', {
        documentId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw new Error(
        `Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    logger.info(`Generated embeddings`, { documentId, count: embeddings.length });

    if (ingestionJob) {
      await prisma.ingestionJob.update({
        where: { id: ingestionJob.id },
        data: { progress: 70 },
      });
    }

    // Step 3: Prepare chunk data for insertion
    interface ChunkMetadata {
      start: number;
      end: number;
      page?: number;
      section?: string;
    }

    const chunkData = chunks.map((chunk, index) => {
      const metadata = chunk.metadata as ChunkMetadata;
      return {
        documentId: chunk.documentId,
        content: chunk.content,
        embedding: embeddings[index] ?? [],
        index: chunk.index,
        start: metadata.start,
        end: metadata.end,
        page: metadata.page,
        section: metadata.section,
      };
    });

    // Validate chunks before insertion
    const { valid, invalid } = validateChunks(chunkData);

    if (invalid.length > 0) {
      logger.warn(`Invalid chunks found`, {
        documentId,
        count: invalid.length,
        reasons: invalid.map((i) => i.reason),
      });
    }

    if (valid.length === 0) {
      throw new Error('No valid chunks to insert');
    }

    // Step 4: Store chunks with embeddings using batch operations
    logger.info(`Storing chunks in vector database`, { documentId, count: valid.length });

    const insertResult = await batchInsertChunks(prisma, valid, {
      batchSize: options.batchSize ?? 50,
      continueOnError: true,
      onProgress: (completed, total) => {
        const progress = 70 + Math.round((completed / total) * 25);
        if (ingestionJob) {
          prisma.ingestionJob
            .update({
              where: { id: ingestionJob.id },
              data: { progress: Math.min(progress, 95) },
            })
            .catch((err: Error) =>
              logger.error('Failed to update job progress', { error: err.message })
            );
        }
      },
    });

    logger.info(`Insert complete`, {
      documentId,
      successCount: insertResult.successCount,
      failureCount: insertResult.failureCount,
      durationMs: insertResult.durationMs,
    });

    // Log any errors
    if (insertResult.errors.length > 0) {
      logger.warn('Insert errors', { documentId, errors: insertResult.errors });
    }

    // Step 5: Update document status
    const processingTime = Date.now() - startTime;

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: insertResult.failureCount === 0 ? 'COMPLETED' : 'COMPLETED',
        metadata: {
          ...((document.metadata as Record<string, unknown>) ?? {}),
          processedAt: new Date().toISOString(),
          chunkCount: valid.length,
          embeddingModel: embeddingProvider.modelName,
          embeddingDimensions: embeddingProvider.dimensions,
          processingTime,
          insertStats: {
            successCount: insertResult.successCount,
            failureCount: insertResult.failureCount,
          },
        },
      },
    });

    if (ingestionJob) {
      await prisma.ingestionJob.update({
        where: { id: ingestionJob.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          completedAt: new Date(),
        },
      });
    }

    logger.info(`Document processed`, { documentId, processingTimeMs: processingTime });
  } catch (error) {
    logger.error(`Error processing document`, {
      documentId,
      error: error instanceof Error ? error.message : 'Unknown',
    });

    // Update document status to failed
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          failedAt: new Date().toISOString(),
        },
      },
    });

    // Update ingestion job
    const ingestionJob = await prisma.ingestionJob.findUnique({
      where: { documentId },
    });

    if (ingestionJob) {
      await prisma.ingestionJob.update({
        where: { id: ingestionJob.id },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }

    throw error;
  }
}

/**
 * Re-process a document (useful for re-embedding with a different model)
 */
export async function reprocessDocument(
  documentId: string,
  options: IngestionOptions & { embeddingModel?: string } = {}
): Promise<void> {
  // Delete existing chunks
  await prisma.documentChunk.deleteMany({
    where: { documentId },
  });

  // Reset document status
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'PENDING',
      metadata: {},
    },
  });

  // Re-process
  await processDocument(documentId, options);
}

// ============================================================================
// Metadata Extraction
// ============================================================================

/**
 * Extract metadata from document content
 */
export function extractMetadata(content: string, type: DocumentType): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  // Word count
  metadata.wordCount = content.split(/\s+/).length;

  // Character count
  metadata.characterCount = content.length;

  // Line count
  metadata.lineCount = content.split('\n').length;

  // Try to extract title (first non-empty line for text files)
  if (type === 'TXT' || type === 'MD') {
    const lines = content.split('\n').filter((line) => line.trim());
    if (lines.length > 0) {
      metadata.title = lines[0]?.replace(/^#+\s*/, '').slice(0, 100);
    }
  }

  return metadata;
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check if the ingestion pipeline is healthy
 */
export async function checkIngestionHealth(): Promise<{
  healthy: boolean;
  embeddingProvider: boolean;
  database: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let embeddingProvider = false;
  let database = false;

  // Check embedding provider
  try {
    const provider = createEmbeddingProviderFromEnv();
    if (provider.healthCheck) {
      embeddingProvider = await provider.healthCheck();
      if (!embeddingProvider) {
        errors.push('Embedding provider health check failed');
      }
    } else {
      embeddingProvider = true;
    }
  } catch (error) {
    errors.push(`Embedding provider error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch (error) {
    errors.push(`Database error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  return {
    healthy: embeddingProvider && database,
    embeddingProvider,
    database,
    errors,
  };
}
