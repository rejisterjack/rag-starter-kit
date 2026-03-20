/**
 * Inngest Background Job Functions
 * 
 * Handles document ingestion processing in the background
 */

import { inngest } from './client';
import { prisma } from '@/lib/db';
import { createEmbeddings } from '@/lib/rag/engine';
import { ChunkingEngine } from '@/lib/rag/chunking';
// import { parsePDF } from '@/lib/rag/ingestion/parsers/pdf';
// import { parseDOCX } from '@/lib/rag/ingestion/parsers/docx';
// import { parseText } from '@/lib/rag/ingestion/parsers/txt';
// import { parseHTML } from '@/lib/rag/ingestion/parsers/html';
import { scrapeURL } from '@/lib/rag/ingestion/parsers/url';

// =============================================================================
// Document Ingestion Job
// =============================================================================

/**
 * Background job to process document ingestion
 * 
 * This function:
 * 1. Creates document chunks from parsed content
 * 2. Generates embeddings for each chunk
 * 3. Stores chunks in the database with embeddings
 * 4. Updates document status throughout the process
 * 5. Emits events for progress tracking
 */
export const processDocumentJob = inngest.createFunction(
  {
    id: 'process-document',
    name: 'Process Document Ingestion',
    concurrency: 5, // Process up to 5 documents simultaneously
    retries: 3,
    onFailure: async ({ event, error }) => {
      // Log failure for monitoring
      console.error('Document ingestion failed:', {
        documentId: event.data.documentId,
        error: error.message,
      });

      // Update document and job status
      await prisma.document.update({
        where: { id: event.data.documentId },
        data: {
          status: 'FAILED',
          metadata: {
            error: error.message,
            failedAt: new Date().toISOString(),
          },
        },
      });

      await prisma.ingestionJob.updateMany({
        where: { documentId: event.data.documentId },
        data: {
          status: 'FAILED',
          error: error.message,
          completedAt: new Date(),
        },
      });

      // Send failure event
      await inngest.send({
        name: 'document/ingestion.failed',
        data: {
          documentId: event.data.documentId,
          userId: event.data.userId,
          error: error.message,
        },
      });
    },
  },
  { event: 'document/ingest' },
  async ({ event, step }) => {
    const { documentId, userId } = event.data;
    const startTime = Date.now();

    // =============================================================================
    // Step 1: Create Ingestion Job Record
    // =============================================================================
    const job = await step.run('create-job', async () => {
      // Delete any existing jobs for this document
      await prisma.ingestionJob.deleteMany({
        where: { documentId },
      });

      // Create new job
      return prisma.ingestionJob.create({
        data: {
          documentId,
          status: 'QUEUED',
          progress: 0,
        },
      });
    });

    // Send started event
    await step.run('emit-started', () =>
      inngest.send({
        name: 'document/ingestion.started',
        data: {
          documentId,
          userId,
          jobId: job.id,
        },
      })
    );

    // =============================================================================
    // Step 2: Fetch and Parse Document
    // =============================================================================
    await step.run('update-status-parsing', () =>
      updateJobStatus(job.id, {
        status: 'PROCESSING',
        progress: 5,
        startedAt: new Date(),
      })
    );

    const document = await step.run('fetch-document', async () => {
      const doc = await prisma.document.findUnique({
        where: { id: documentId },
      });

      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Update document status
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING' },
      });

      return doc;
    });

    // Parse document based on type
    const parsedContent = await step.run('parse-document', async () => {
      if (!document.content) {
        // Fetch and parse content based on document type
        if (document.contentType === 'HTML' && document.metadata) {
          const metadata = document.metadata as Record<string, unknown>;
          if (metadata.sourceUrl) {
            const scraped = await scrapeURL(metadata.sourceUrl as string);
            await prisma.document.update({
              where: { id: documentId },
              data: { content: scraped.text },
            });
            return {
              text: scraped.text,
              metadata: scraped.metadata,
            };
          }
        }
        throw new Error('Document has no content');
      }

      // Content already exists
      return {
        text: document.content,
        metadata: document.metadata as Record<string, unknown> || {},
      };
    });

    await step.run('emit-progress-parsed', () =>
      emitProgress(documentId, userId, 'parse', 20, 'Document parsed')
    );

    // =============================================================================
    // Step 3: Create Chunks
    // =============================================================================
    const chunks = await step.run('create-chunks', async () => {
      // Determine optimal chunk size based on document type
      const chunkSize = document.contentType === 'PDF' ? 1200 : 
                        document.contentType === 'MD' ? 1500 : 1000;
      const chunkOverlap = 200;

      return ChunkingEngine.chunk(parsedContent.text, {
        strategy: 'fixed',
        chunkSize,
        chunkOverlap,
        documentId,
      });
    });

    await step.run('update-progress-chunked', () =>
      updateJobStatus(job.id, { progress: 40 })
    );

    await step.run('emit-progress-chunked', () =>
      emitProgress(documentId, userId, 'chunk', 40, `${chunks.length} chunks created`)
    );

    // =============================================================================
    // Step 4: Generate Embeddings
    // =============================================================================
    await step.run('update-status-embedding', () =>
      updateJobStatus(job.id, { progress: 50 })
    );

    const embeddings = createEmbeddings();

    // Process chunks in batches
    const batchSize = 20;
    const totalChunks = chunks.length;

    for (let i = 0; i < totalChunks; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);

      await step.run(`generate-embeddings-batch-${batchIndex}`, async () => {
        const contents = batch.map(c => c.content);
        const embeddingVectors = await embeddings.embedDocuments(contents);

        // Store chunks with embeddings
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const vector = embeddingVectors[j];

          await prisma.$executeRaw`
            INSERT INTO document_chunks (
              id, document_id, content, embedding, index, start, "end", page, section, created_at
            ) VALUES (
              ${crypto.randomUUID()},
              ${documentId},
              ${chunk.content},
              ${vector}::vector,
              ${chunk.metadata.index},
              ${chunk.metadata.start},
              ${chunk.metadata.end},
              ${chunk.metadata.page || null},
              ${chunk.metadata.headings?.[0] || null},
              NOW()
            )
          `;
        }

        // Update progress
        const progress = Math.round(50 + ((i + batch.length) / totalChunks) * 45);
        await updateJobStatus(job.id, { progress });

        // Emit progress event
        await emitProgress(
          documentId,
          userId,
          'embed',
          progress,
          `Embedded ${i + batch.length}/${totalChunks} chunks`
        );

        return {
          batchIndex,
          processed: batch.length,
        };
      });
    }

    // =============================================================================
    // Step 5: Finalize
    // =============================================================================
    const processingTime = Date.now() - startTime;

    await step.run('finalize-document', async () => {
      // Update document status
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'COMPLETED',
          chunkCount: totalChunks,
          metadata: {
            ...parsedContent.metadata,
            processedAt: new Date().toISOString(),
            processingTimeMs: processingTime,
            totalChunks,
          },
        },
      });

      // Update job status
      await prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          completedAt: new Date(),
        },
      });

      return { totalChunks, processingTime };
    });

    // Send completion event
    await step.run('emit-completed', () =>
      inngest.send({
        name: 'document/ingestion.completed',
        data: {
          documentId,
          userId,
          chunkCount: totalChunks,
          processingTimeMs: processingTime,
        },
      })
    );

    return {
      success: true,
      documentId,
      jobId: job.id,
      chunkCount: totalChunks,
      processingTimeMs: processingTime,
    };
  }
);

// =============================================================================
// Retry Failed Ingestion Job
// =============================================================================

export const retryIngestionJob = inngest.createFunction(
  {
    id: 'retry-ingestion',
    name: 'Retry Failed Document Ingestion',
    retries: 2,
  },
  { event: 'document/ingestion.retry' },
  async ({ event, step }) => {
    const { documentId, userId } = event.data;

    // Clear previous error state
    await step.run('reset-document', async () => {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'PENDING',
          metadata: {
            retriedAt: new Date().toISOString(),
          },
        },
      });

      // Delete existing chunks
      await prisma.documentChunk.deleteMany({
        where: { documentId },
      });
    });

    // Re-queue for processing
    await step.run('requeue-job', () =>
      inngest.send({
        name: 'document/ingest',
        data: { documentId, userId },
      })
    );

    return { success: true, documentId };
  }
);

// =============================================================================
// Bulk Ingestion Job
// =============================================================================

export const bulkIngestJob = inngest.createFunction(
  {
    id: 'bulk-ingest',
    name: 'Bulk Document Ingestion',
    concurrency: 1, // Process one bulk job at a time
  },
  { event: 'document/bulk-ingest' },
  async ({ event, step }) => {
    const { documentIds, userId } = event.data;
    const results: Array<{ documentId: string; success: boolean; error?: string }> = [];

    for (const documentId of documentIds) {
      try {
        await step.run(`process-${documentId}`, async () => {
          await inngest.send({
            name: 'document/ingest',
            data: { documentId, userId },
          });
        });

        results.push({ documentId, success: true });
      } catch (error) {
        results.push({
          documentId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Send bulk completion event
    await step.run('emit-bulk-completed', () =>
      inngest.send({
        name: 'document/bulk-ingest.completed',
        data: {
          userId,
          totalCount: documentIds.length,
          successCount: results.filter(r => r.success).length,
          failureCount: results.filter(r => !r.success).length,
          results,
        },
      })
    );

    return {
      totalCount: documentIds.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      results,
    };
  }
);

// =============================================================================
// Cleanup Job
// =============================================================================

export const cleanupStaleJobs = inngest.createFunction(
  {
    id: 'cleanup-stale-jobs',
    name: 'Cleanup Stale Ingestion Jobs',
  },
  { cron: '0 */6 * * *' }, // Run every 6 hours
  async ({ step }) => {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    const staleJobs = await step.run('find-stale-jobs', async () => {
      return prisma.ingestionJob.findMany({
        where: {
          status: 'PROCESSING',
          startedAt: {
            lt: sixHoursAgo,
          },
        },
      });
    });

    for (const job of staleJobs) {
      await step.run(`cleanup-job-${job.id}`, async () => {
        // Mark job as failed
        await prisma.ingestionJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            error: 'Job timed out after 6 hours',
            completedAt: new Date(),
          },
        });

        // Update document status
        await prisma.document.update({
          where: { id: job.documentId },
          data: {
            status: 'FAILED',
            metadata: {
              error: 'Processing timeout',
            },
          },
        });
      });
    }

    return {
      cleanedUpCount: staleJobs.length,
    };
  }
);

// =============================================================================
// Helper Functions
// =============================================================================

async function updateJobStatus(
  jobId: string,
  data: {
    status?: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    progress?: number;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
  }
) {
  return prisma.ingestionJob.update({
    where: { id: jobId },
    data,
  });
}

async function emitProgress(
  documentId: string,
  userId: string,
  stage: string,
  progress: number,
  message: string
) {
  return inngest.send({
    name: 'document/ingestion.progress',
    data: {
      documentId,
      userId,
      stage,
      progress,
      message,
      timestamp: new Date().toISOString(),
    },
  });
}

// =============================================================================
// Event Types (for type safety)
// =============================================================================

declare module 'inngest' {
  interface Events {
    'document/ingest': {
      data: {
        documentId: string;
        userId: string;
      };
    };
    'document/ingestion.started': {
      data: {
        documentId: string;
        userId: string;
        jobId: string;
      };
    };
    'document/ingestion.progress': {
      data: {
        documentId: string;
        userId: string;
        stage: string;
        progress: number;
        message: string;
        timestamp: string;
      };
    };
    'document/ingestion.completed': {
      data: {
        documentId: string;
        userId: string;
        chunkCount: number;
        processingTimeMs: number;
      };
    };
    'document/ingestion.failed': {
      data: {
        documentId: string;
        userId: string;
        error: string;
      };
    };
    'document/ingestion.retry': {
      data: {
        documentId: string;
        userId: string;
      };
    };
    'document/bulk-ingest': {
      data: {
        documentIds: string[];
        userId: string;
      };
    };
    'document/bulk-ingest.completed': {
      data: {
        userId: string;
        totalCount: number;
        successCount: number;
        failureCount: number;
        results: Array<{ documentId: string; success: boolean; error?: string }>;
      };
    };
  }
}
