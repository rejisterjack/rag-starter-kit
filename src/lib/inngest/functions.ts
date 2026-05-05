/**
 * Inngest Background Job Functions
 *
 * Handles document ingestion processing in the background
 */

import { detectCostAnomalies } from '@/lib/billing/cost-monitor';
import { prisma } from '@/lib/db';
import { detachOldPartitions, ensurePartitions } from '@/lib/db/partition-manager';
import { logger } from '@/lib/logger';
import { dispatchAlert } from '@/lib/monitoring/alerting';
import { detectAnomalies } from '@/lib/monitoring/anomaly-detector';
import { ChunkingEngine } from '@/lib/rag/chunking';
import { createEmbeddings } from '@/lib/rag/engine';
import { scrapeURL } from '@/lib/rag/ingestion/parsers/url';
import { isYouTubeUrl, parseYouTube } from '@/lib/rag/ingestion/parsers/youtube';
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
      const docLimit = await step.run('check-doc-limit', async () => {
        return checkDocumentLimit(document.workspaceId as string);
      });

      if (!docLimit.allowed) {
        await step.run('fail-limit-exceeded', async () => {
          await prisma.document.update({
            where: { id: documentId },
            data: {
              status: 'FAILED',
              metadata: {
                error: docLimit.reason,
                failedAt: new Date().toISOString(),
              },
            },
          });

          await prisma.ingestionJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              error: docLimit.reason || 'Document limit exceeded',
              completedAt: new Date(),
            },
          });
        });

        throw new Error(docLimit.reason || 'Document limit exceeded');
      }
    }

    // Parse document based on type
    const parsedContent = await step.run('parse-document', async () => {
      if (!document.content) {
        const metadata = (document.metadata as Record<string, unknown>) || {};

        // YouTube URL — extract transcript
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

        // HTML URL — scrape content
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
          return {
            text: scraped.text,
            metadata: scraped.metadata,
          };
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
            const settings = workspace.settings as Record<string, unknown>;
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
            ...((existingDoc?.metadata as Record<string, unknown>) ?? {}),
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
// Cost Monitoring Job
// =============================================================================

export const costMonitoringJob = inngest.createFunction(
  {
    id: 'cost-monitoring',
    name: 'Run Cost Anomaly Detection',
  },
  { cron: '*/15 * * * *' },
  async ({ step }: { step: InngestContext['step'] }) => {
    const anomalies = await step.run('detect-cost-anomalies', async () => {
      return detectCostAnomalies();
    });

    if (anomalies.length > 0) {
      await step.run('dispatch-cost-alerts', async () => {
        for (const anomaly of anomalies) {
          await dispatchAlert({
            type: `cost_anomaly:${anomaly.severity === 'CRITICAL' ? 'critical' : 'warning'}`,
            severity: anomaly.severity,
            description: `Workspace ${anomaly.workspaceId}: ${anomaly.multiplier}x normal spend (${anomaly.currentHourTokens} tokens vs ${anomaly.hourlyAverage} avg)`,
            workspaceId: anomaly.workspaceId,
            metadata: {
              currentHourTokens: anomaly.currentHourTokens,
              hourlyAverage: anomaly.hourlyAverage,
              multiplier: anomaly.multiplier,
            },
            detectedAt: new Date(),
          });
        }
      });
    }

    return { checked: true, anomalyCount: anomalies.length };
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

    return { detached };
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
