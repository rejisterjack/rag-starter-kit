/**
 * Inngest Background Job Functions
 *
 * Handles document ingestion processing in the background
 */

import { prisma } from '@/lib/db';
import { ChunkingEngine } from '@/lib/rag/chunking';
import { createEmbeddings } from '@/lib/rag/engine';
import { scrapeURL } from '@/lib/rag/ingestion/parsers/url';
import { inngest } from './client';

// =============================================================================
// Event Types
// =============================================================================

interface IngestEventData {
  documentId: string;
  userId: string;
}

interface BulkIngestData {
  documentIds: string[];
  userId: string;
}

// Inngest handler context type
type InngestContext = {
  event: { data: IngestEventData };
  step: {
    run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
  };
};

// =============================================================================
// Document Ingestion Job
// =============================================================================

/**
 * Background job to process document ingestion
 */
export const processDocumentJob = inngest.createFunction(
  {
    id: 'process-document',
    name: 'Process Document Ingestion',
    concurrency: 5,
    retries: 3,
    triggers: [{ event: 'document/ingest' }],
  },
  async ({ event, step }: { event: { data: IngestEventData }; step: InngestContext['step'] }) => {
    const { documentId, userId } = event.data;
    const startTime = Date.now();

    // Step 1: Create Ingestion Job Record
    const job = await step.run('create-job', async () => {
      await prisma.ingestionJob.deleteMany({
        where: { documentId },
      });

      return prisma.ingestionJob.create({
        data: {
          documentId,
          status: 'QUEUED',
          progress: 0,
        },
      });
    });

    // Send started event
    await step.run('emit-started', async () => {
      await inngest.send({
        name: 'document/ingestion.started',
        data: {
          documentId,
          userId,
          jobId: job.id,
        },
      });
    });

    // Step 2: Fetch and Parse Document
    await step.run('update-status-parsing', async () =>
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

      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING' },
      });

      return doc;
    });

    // Parse document based on type
    const parsedContent = await step.run('parse-document', async () => {
      if (!document.content) {
        if (document.contentType === 'HTML' && document.metadata) {
          const metadata = document.metadata as Record<string, unknown>;
          if (metadata.sourceUrl && typeof metadata.sourceUrl === 'string') {
            const scraped = await scrapeURL(metadata.sourceUrl);
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

      return {
        text: document.content,
        metadata: (document.metadata as Record<string, unknown>) || {},
      };
    });

    await step.run('emit-progress-parsed', async () =>
      emitProgress(documentId, userId, 'parse', 20, 'Document parsed')
    );

    // Step 3: Create Chunks
    const chunks = await step.run('create-chunks', async () => {
      const chunkSize =
        document.contentType === 'PDF' ? 1200 : document.contentType === 'MD' ? 1500 : 1000;
      const chunkOverlap = 200;

      return ChunkingEngine.chunk(parsedContent.text, {
        strategy: 'fixed',
        chunkSize,
        chunkOverlap,
        documentId,
      });
    });

    await step.run('update-progress-chunked', async () =>
      updateJobStatus(job.id, { progress: 40 })
    );

    await step.run('emit-progress-chunked', async () =>
      emitProgress(documentId, userId, 'chunk', 40, `${chunks.length} chunks created`)
    );

    // Step 4: Generate Embeddings
    await step.run('update-status-embedding', async () =>
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
        const contents = batch.map((chunk) => chunk.content);
        const embeddingVectors = await embeddings.embedDocuments(contents);

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
              ${chunk.metadata.page ?? null},
              ${chunk.metadata.headings?.[0] ?? null},
              NOW()
            )
          `;
        }

        const progress = Math.round(50 + ((i + batch.length) / totalChunks) * 45);
        await updateJobStatus(job.id, { progress });

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

    // Step 5: Finalize
    const processingTime = Date.now() - startTime;

    await step.run('finalize-document', async () => {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'COMPLETED',
          metadata: {
            ...parsedContent.metadata,
            processedAt: new Date().toISOString(),
            processingTimeMs: processingTime,
            totalChunks,
          },
        },
      });

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

    await step.run('emit-completed', async () =>
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
    triggers: [{ event: 'document/ingestion.retry' }],
  },
  async ({ event, step }: { event: { data: IngestEventData }; step: InngestContext['step'] }) => {
    const { documentId, userId } = event.data;

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

      await prisma.documentChunk.deleteMany({
        where: { documentId },
      });
    });

    await step.run('requeue-job', async () =>
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
    concurrency: 1,
    triggers: [{ event: 'document/bulk-ingest' }],
  },
  async ({ event, step }: { event: { data: BulkIngestData }; step: InngestContext['step'] }) => {
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

    await step.run('emit-bulk-completed', async () =>
      inngest.send({
        name: 'document/bulk-ingest.completed',
        data: {
          userId,
          totalCount: documentIds.length,
          successCount: results.filter((r) => r.success).length,
          failureCount: results.filter((r) => !r.success).length,
          results,
        },
      })
    );

    return {
      totalCount: documentIds.length,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
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
    triggers: [{ cron: '0 */6 * * *' }],
  },
  async ({ step }: { step: InngestContext['step'] }) => {
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
        await prisma.ingestionJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            error: 'Job timed out after 6 hours',
            completedAt: new Date(),
          },
        });

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
): Promise<void> {
  await prisma.ingestionJob.update({
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
): Promise<void> {
  await inngest.send({
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
