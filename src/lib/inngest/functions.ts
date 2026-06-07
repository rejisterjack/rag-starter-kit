/**
 * Inngest Background Job Functions
 *
 * Handles document ingestion processing in the background
 */

import { prisma } from '@/lib/db';
import { fromJson } from '@/lib/db/json';
import {
  checkPartitionHealth,
  detachOldPartitions,
  ensurePartitions,
} from '@/lib/db/partition-manager';
import { logger } from '@/lib/logger';
import { dispatchAlert } from '@/lib/monitoring/alerting';
import { detectAnomalies } from '@/lib/monitoring/anomaly-detector';
import {
  type ChunkPointData,
  COLLECTION_DOCUMENT_CHUNKS,
  deleteByDocumentId,
  qdrant,
  upsertChunks,
} from '@/lib/qdrant';
import { ChunkingEngine } from '@/lib/rag/chunking';
import { createEmbeddings } from '@/lib/rag/engine';
import {
  parseAudio,
  parseDOCX,
  parseHTML,
  parsePDF,
  parsePPTXBuffer,
  parseText,
  parseVideo,
  parseXLSXBuffer,
} from '@/lib/rag/ingestion';
import { scrapeURL } from '@/lib/rag/ingestion/parsers/url';
import { isYouTubeUrl, parseYouTube } from '@/lib/rag/ingestion/parsers/youtube';
import { deleteDocumentFiles, getFile } from '@/lib/storage/cloudinary-storage';
import { checkDocumentLimit } from '@/lib/workspace/resource-limits';
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
  },
  { event: 'document/ingest' },
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

    // Step 2b: Re-check workspace document limit (guard against race conditions)
    if (document.workspaceId) {
      const workspaceId = document.workspaceId;
      const docLimit = await step.run('check-doc-limit', async () => {
        return checkDocumentLimit(workspaceId);
      });

      if (!docLimit.allowed) {
        const limitReason = docLimit.reason || 'Document limit exceeded';
        await step.run('fail-limit-exceeded', async () => {
          await prisma.document.update({
            where: { id: documentId },
            data: {
              status: 'FAILED',
              metadata: {
                error: limitReason,
                failedAt: new Date().toISOString(),
              },
            },
          });

          await prisma.ingestionJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              error: limitReason,
              errorCategory: 'SIZE_LIMIT',
              completedAt: new Date(),
            },
          });
        });

        throw new Error(limitReason);
      }
    }

    // Parse document based on type
    const parsedContent = await step.run('parse-document', async () => {
      const metadata = fromJson<Record<string, unknown>>(document.metadata, {});

      // Case 1: File uploaded to Cloudinary — download and parse
      if (!document.content && document.storageUrl) {
        const buffer = await getFile(document.storageUrl);

        const parsed = await parseBuffer(buffer, document.contentType);
        await prisma.document.update({
          where: { id: documentId },
          data: { content: parsed },
        });
        return {
          text: parsed,
          metadata: { ...metadata, source: 'file', parsedFrom: 'cloudinary' },
        };
      }

      // Case 2: YouTube URL — extract transcript
      if (!document.content) {
        if (
          (document.contentType === 'VIDEO' || metadata.isYouTube) &&
          metadata.sourceUrl &&
          typeof metadata.sourceUrl === 'string' &&
          isYouTubeUrl(metadata.sourceUrl)
        ) {
          const ytResult = await parseYouTube(metadata.sourceUrl);
          await prisma.document.update({
            where: { id: documentId },
            data: { content: ytResult.text },
          });
          return {
            text: ytResult.text,
            metadata: {
              videoId: ytResult.videoId,
              title: ytResult.title,
              channelName: ytResult.channelName,
              duration: ytResult.duration,
              captionCount: ytResult.captions.length,
            },
          };
        }

        // Case 3: HTML URL — scrape content
        if (
          document.contentType === 'HTML' &&
          metadata.sourceUrl &&
          typeof metadata.sourceUrl === 'string'
        ) {
          const scraped = await scrapeURL(metadata.sourceUrl);
          await prisma.document.update({
            where: { id: documentId },
            data: { content: scraped.text },
          });
          return { text: scraped.text, metadata: scraped.metadata };
        }

        throw new Error('Document has no content and no storageUrl');
      }

      // Case 4: Content already populated (raw text ingestion)
      return { text: document.content, metadata };
    });

    await step.run('emit-progress-parsed', async () =>
      emitProgress(documentId, userId, 'parse', 20, 'Document parsed')
    );

    // Step 3: Create Chunks
    // FEATURE: Dynamic chunking strategy from workspace settings
    const chunks = await step.run('create-chunks', async () => {
      const defaultChunkSize =
        document.contentType === 'PDF' ? 1200 : document.contentType === 'MD' ? 1500 : 1000;
      const defaultChunkOverlap = 200;

      // Fetch workspace settings to determine chunking strategy and parameters
      let strategy: 'fixed' | 'semantic' | 'hierarchical' | 'late' = 'fixed';
      let chunkSize = defaultChunkSize;
      let chunkOverlap = defaultChunkOverlap;

      if (document.workspaceId) {
        try {
          const workspace = await prisma.workspace.findUnique({
            where: { id: document.workspaceId },
            select: { settings: true },
          });

          if (workspace?.settings) {
            const settings = fromJson<Record<string, unknown>>(workspace.settings, {});
            const ragSettings = settings.rag as Record<string, unknown> | undefined;
            const workspaceStrategy = ragSettings?.chunkingStrategy;

            if (
              workspaceStrategy &&
              ['fixed', 'semantic', 'hierarchical', 'late'].includes(workspaceStrategy as string)
            ) {
              strategy = workspaceStrategy as 'fixed' | 'semantic' | 'hierarchical' | 'late';
            }

            if (
              typeof ragSettings?.chunkSize === 'number' &&
              ragSettings.chunkSize >= 100 &&
              ragSettings.chunkSize <= 4000
            ) {
              chunkSize = ragSettings.chunkSize;
            }
            if (
              typeof ragSettings?.chunkOverlap === 'number' &&
              ragSettings.chunkOverlap >= 0 &&
              ragSettings.chunkOverlap <= 1000
            ) {
              chunkOverlap = ragSettings.chunkOverlap;
            }
          }
        } catch (error: unknown) {
          // Fall back to defaults if workspace settings can't be read
          const message = error instanceof Error ? error.message : 'Unknown error';
          logger.warn('Failed to read workspace chunking settings, using defaults', {
            workspaceId: document.workspaceId,
            error: message,
          });
        }
      }

      return ChunkingEngine.chunk(parsedContent.text, {
        strategy,
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
    // FIXED: Increased from 20 to 100 to match Google's limit and reduce API calls
    const batchSize = 100;
    const totalChunks = chunks.length;

    for (let i = 0; i < totalChunks; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize);

      await step.run(`generate-embeddings-batch-${batchIndex}`, async () => {
        const contents = batch.map((chunk) => chunk.content);
        const embeddingVectors = await embeddings.embedDocuments(contents);

        const pointData: ChunkPointData[] = batch.map((chunk, j) => ({
          documentId,
          content: chunk.content,
          embedding: embeddingVectors[j] ?? [],
          index: chunk.metadata.index,
          start: chunk.metadata.start,
          end: chunk.metadata.end,
          page: chunk.metadata.page ?? null,
          section: chunk.metadata.headings?.[0] ?? null,
        }));

        await upsertChunks(pointData, {
          userId,
          workspaceId: document.workspaceId ?? undefined,
          documentName: document.name,
          documentType: document.contentType,
        });

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
  },
  { event: 'document/ingestion.retry' },
  async ({ event, step }: { event: { data: IngestEventData }; step: InngestContext['step'] }) => {
    const { documentId, userId } = event.data;

    await step.run('reset-document', async () => {
      // FIXED: Merge with existing metadata instead of overwriting
      const existingDoc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { metadata: true },
      });

      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'PENDING',
          metadata: {
            ...fromJson<Record<string, unknown>>(existingDoc?.metadata ?? null, {}),
            retriedAt: new Date().toISOString(),
          },
        },
      });

      await deleteByDocumentId(documentId);
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
  },
  { event: 'document/bulk-ingest' },
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
// Anomaly Detection Job
// =============================================================================

export const anomalyDetectionJob = inngest.createFunction(
  {
    id: 'anomaly-detection',
    name: 'Run Anomaly Detection',
  },
  { cron: '*/5 * * * *' },
  async ({ step }: { step: InngestContext['step'] }) => {
    const alerts = await step.run('detect-anomalies', async () => {
      return detectAnomalies();
    });

    if (alerts.length > 0) {
      await step.run('dispatch-alerts', async () => {
        await Promise.all(alerts.map((alert) => dispatchAlert(alert)));
      });
    }

    return { checked: true, alertCount: alerts.length };
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
  { cron: '0 */6 * * *' },
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
            errorCategory: 'NETWORK_ERROR',
            completedAt: new Date(),
          },
        });

        const doc = await prisma.document.update({
          where: { id: job.documentId },
          data: {
            status: 'FAILED',
            metadata: {
              error: 'Processing timeout',
            },
          },
          select: { storageKey: true },
        });

        // Clean up Cloudinary files for failed documents
        if (doc.storageKey) {
          await deleteDocumentFiles(job.documentId).catch(() => {});
        }

        await deleteByDocumentId(job.documentId).catch(() => {});
      });
    }

    return {
      cleanedUpCount: staleJobs.length,
    };
  }
);

// =============================================================================
// Nightly Database Cleanup Job (RateLimit + AuditLog TTL)
// =============================================================================

/**
 * Runs daily at 03:00 UTC.
 * Purges expired rate-limit windows and rotates old audit log entries
 * to prevent unbounded table growth.
 *
 * Retention policy (configurable via env):
 *   RATE_LIMIT_RETENTION_DAYS  — default 7
 *   AUDIT_LOG_RETENTION_DAYS   — default 90
 */
export const nightlyDbCleanupJob = inngest.createFunction(
  {
    id: 'nightly-db-cleanup',
    name: 'Nightly Database Cleanup (RateLimit + AuditLog)',
  },
  { cron: '0 3 * * *' }, // 03:00 UTC every day
  async ({ step }: { step: InngestContext['step'] }) => {
    const rateLimitRetentionDays = Number(process.env.RATE_LIMIT_RETENTION_DAYS ?? '7');
    const auditLogRetentionDays = Number(process.env.AUDIT_LOG_RETENTION_DAYS ?? '90');

    const rateLimitCutoff = new Date(Date.now() - rateLimitRetentionDays * 24 * 60 * 60 * 1000);
    const auditLogCutoff = new Date(Date.now() - auditLogRetentionDays * 24 * 60 * 60 * 1000);

    // --- 1. Delete expired rate limit windows ---
    const deletedRateLimits = await step.run('delete-expired-rate-limits', async () => {
      const result = await prisma.rateLimit.deleteMany({
        where: {
          windowStart: { lt: rateLimitCutoff },
        },
      });
      return result.count;
    });

    // --- 2. Delete old audit log entries ---
    const deletedAuditLogs = await step.run('delete-old-audit-logs', async () => {
      const result = await prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: auditLogCutoff },
        },
      });
      return result.count;
    });

    // --- 3. Delete expired verification tokens ---
    const deletedVerificationTokens = await step.run(
      'delete-expired-verification-tokens',
      async () => {
        const result = await prisma.verificationToken.deleteMany({
          where: {
            expires: { lt: new Date() },
          },
        });
        return result.count;
      }
    );

    return {
      deletedRateLimits,
      deletedAuditLogs,
      deletedVerificationTokens,
      retentionPolicy: {
        rateLimitDays: rateLimitRetentionDays,
        auditLogDays: auditLogRetentionDays,
      },
    };
  }
);

// =============================================================================
// Partition Maintenance Job
// =============================================================================

export const partitionMaintenanceJob = inngest.createFunction(
  {
    id: 'partition-maintenance',
    name: 'Maintain Table Partitions',
  },
  { cron: '0 0 1 * *' }, // first of each month
  async ({ step }: { step: InngestContext['step'] }) => {
    await step.run('ensure-future-partitions', async () => {
      await ensurePartitions(3);
    });

    const detached = await step.run('detach-old-partitions', async () => {
      return detachOldPartitions(12); // keep 12 months of data
    });

    const health = await step.run('check-partition-health', async () => {
      return checkPartitionHealth();
    });

    return { detached, healthy: health.healthy, warnings: health.warnings.length };
  }
);

// =============================================================================
// Helper Functions
// =============================================================================

async function parseBuffer(buffer: Buffer, contentType: string): Promise<string> {
  switch (contentType) {
    case 'PDF':
      return parsePDF(buffer);
    case 'DOCX':
      return parseDOCX(buffer);
    case 'XLSX':
      return parseXLSXBuffer(buffer);
    case 'PPTX':
      return parsePPTXBuffer(buffer);
    case 'TXT':
    case 'MD':
      return parseText(buffer);
    case 'HTML':
      return parseHTML(buffer);
    case 'AUDIO':
      return parseAudio(buffer, 'audio/mpeg', 'upload.mp3');
    case 'VIDEO':
      return parseVideo(buffer, 'video/mp4', 'upload.mp4');
    default:
      throw new Error(`Unsupported document type: ${contentType}`);
  }
}

async function updateJobStatus(
  jobId: string,
  data: {
    status?: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    progress?: number;
    error?: string;
    errorCategory?:
      | 'PARSE_ERROR'
      | 'EMBEDDING_ERROR'
      | 'SIZE_LIMIT'
      | 'OCR_FAILURE'
      | 'PROVIDER_ERROR'
      | 'NETWORK_ERROR'
      | 'UNKNOWN';
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
// Re-Embedding Job (for embedding model changes)
// =============================================================================

interface ReEmbedWorkspaceData {
  workspaceId: string;
  userId: string;
  newProvider?: string;
  newModel?: string;
}

/**
 * Background job to re-embed all document chunks in a workspace
 * when the embedding model is changed.
 */
export const reEmbedWorkspaceJob = inngest.createFunction(
  {
    id: 're-embed-workspace',
    name: 'Re-Embed Workspace Documents',
    concurrency: 1,
    retries: 2,
    throttle: { limit: 1, period: '1h' },
  },
  { event: 'workspace/re-embed' },
  async ({
    event,
    step,
  }: {
    event: { data: ReEmbedWorkspaceData };
    step: InngestContext['step'];
  }) => {
    const { workspaceId } = event.data;

    // Step 1: Get all documents in the workspace
    const documents = await step.run('get-documents', async () => {
      const docs = await prisma.document.findMany({
        where: { workspaceId, status: 'COMPLETED' },
        select: { id: true, name: true },
      });
      return docs;
    });

    if (documents.length === 0) {
      logger.info('No documents to re-embed', { workspaceId });
      return { workspaceId, documentsProcessed: 0 };
    }

    // Step 2: Process each document
    const results: Array<{ documentId: string; chunksProcessed: number; error?: string }> = [];

    for (const doc of documents) {
      const result = await step.run(`re-embed-doc-${doc.id}`, async () => {
        try {
          const scrollResult = await qdrant.scroll(COLLECTION_DOCUMENT_CHUNKS, {
            filter: { must: [{ key: 'documentId', match: { value: doc.id } }] },
            limit: 100,
            with_payload: true,
            with_vector: false,
          });
          const chunks = scrollResult.points.map((p) => {
            const payload = p.payload ?? {};
            return {
              id: String(p.id),
              content: String(payload.content ?? ''),
              index: Number(payload.index ?? 0),
            };
          });

          if (chunks.length === 0) {
            return { documentId: doc.id, chunksProcessed: 0 };
          }

          const embeddingEngine = createEmbeddings();
          const BATCH_SIZE = 50;
          let processed = 0;

          for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const texts = batch.map((c) => c.content);
            const vectors = await embeddingEngine.embedDocuments(texts);

            for (let j = 0; j < batch.length; j++) {
              const vector = vectors[j];
              if (vector) {
                const existingPoints = await qdrant.retrieve(COLLECTION_DOCUMENT_CHUNKS, {
                  ids: [batch[j].id],
                  with_payload: true,
                  with_vector: false,
                });
                const existing = existingPoints[0];
                if (existing) {
                  await qdrant.upsert(COLLECTION_DOCUMENT_CHUNKS, {
                    wait: true,
                    points: [
                      {
                        id: existing.id,
                        vector: vector,
                        payload: existing.payload ?? {},
                      },
                    ],
                  });
                }
              }
            }

            processed += batch.length;
          }

          logger.info('Re-embedded document', {
            documentId: doc.id,
            chunksProcessed: processed,
          });

          return { documentId: doc.id, chunksProcessed: processed };
        } catch (error) {
          logger.error('Failed to re-embed document', {
            documentId: doc.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return {
            documentId: doc.id,
            chunksProcessed: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      results.push(result);
    }

    const totalChunks = results.reduce((sum, r) => sum + r.chunksProcessed, 0);
    const failedDocs = results.filter((r) => r.error);

    logger.info('Re-embedding complete', {
      workspaceId,
      totalDocuments: documents.length,
      totalChunks,
      failedDocs: failedDocs.length,
    });

    return {
      workspaceId,
      documentsProcessed: documents.length,
      totalChunks,
      failedDocs: failedDocs.length,
    };
  }
);

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
    'workspace/re-embed': {
      data: {
        workspaceId: string;
        userId: string;
        newProvider?: string;
        newModel?: string;
      };
    };
  }
}
