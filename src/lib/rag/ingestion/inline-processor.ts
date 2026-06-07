/**
 * Inline Document Processor
 *
 * Processes documents directly (without Inngest) as a fallback.
 * Used when the Inngest dev server isn't running.
 */

import { prisma } from '@/lib/db';
import { fromJson } from '@/lib/db/json';
import { logger } from '@/lib/logger';
import { ensureDocumentChunksCollection } from '@/lib/qdrant';
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
import { isYouTubeUrl } from '@/lib/rag/ingestion/parsers/youtube';
import { getFile } from '@/lib/storage/cloudinary-storage';

async function updateJob(jobId: string, data: Record<string, unknown>) {
  try {
    await prisma.ingestionJob.update({ where: { id: jobId }, data });
  } catch {
    // Job was deleted by stale cleanup — recreate it
    try {
      const doc = await prisma.document.findUnique({
        where: { id: data.documentId as string },
        select: { id: true },
      });
      if (doc) {
        await prisma.ingestionJob.create({
          data: {
            id: jobId,
            documentId: data.documentId as string,
            status: 'PROCESSING',
            progress: (data.progress as number) || 0,
            startedAt: new Date(),
          },
        });
      }
    } catch {
      // Give up silently
    }
  }
}

export async function processDocumentInline(
  documentId: string,
  _userId: string
): Promise<{ success: boolean; chunkCount: number; processingTimeMs: number }> {
  const startTime = Date.now();
  let metadata: Record<string, unknown> = {};

  logger.info('Inline processor started', { documentId });

  // Create/update ingestion job
  await prisma.ingestionJob.deleteMany({ where: { documentId } }).catch(() => {});
  let job = await prisma.ingestionJob.findFirst({ where: { documentId } });
  if (!job) {
    job = await prisma.ingestionJob.create({
      data: { documentId, status: 'PROCESSING', progress: 5, startedAt: new Date() },
    });
  } else {
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: 'PROCESSING',
        progress: 5,
        startedAt: new Date(),
        completedAt: null,
        error: null,
      },
    });
  }

  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) throw new Error(`Document not found: ${documentId}`);
  metadata = fromJson<Record<string, unknown>>(document.metadata, {});
  await prisma.document.update({ where: { id: documentId }, data: { status: 'PROCESSING' } });

  // Parse content
  let parsedText = document.content;

  if (!parsedText) {
    if (document.storageUrl) {
      logger.info('Downloading from Cloudinary', { documentId, storageUrl: document.storageUrl });
      const buffer = await getFile(document.storageUrl);
      logger.info('Downloaded file from Cloudinary', { documentId, bufferSize: buffer.length });
      logger.info('Parsing document', { documentId, contentType: document.contentType });
      switch (document.contentType) {
        case 'PDF':
          parsedText = await parsePDF(buffer);
          break;
        case 'DOCX':
          parsedText = await parseDOCX(buffer);
          break;
        case 'XLSX':
          parsedText = await parseXLSXBuffer(buffer);
          break;
        case 'PPTX':
          parsedText = await parsePPTXBuffer(buffer);
          break;
        case 'TXT':
        case 'MD':
          parsedText = parseText(buffer);
          break;
        case 'HTML':
          parsedText = await parseHTML(buffer);
          break;
        case 'AUDIO':
          parsedText = await parseAudio(buffer, 'audio/mpeg', 'upload.mp3');
          break;
        case 'VIDEO':
          parsedText = await parseVideo(buffer, 'video/mp4', 'upload.mp4');
          break;
        default:
          throw new Error(`Unsupported type: ${document.contentType}`);
      }
      await prisma.document.update({ where: { id: documentId }, data: { content: parsedText } });
    } else if (
      (document.contentType === 'VIDEO' || metadata.isYouTube) &&
      metadata.sourceUrl &&
      typeof metadata.sourceUrl === 'string' &&
      isYouTubeUrl(metadata.sourceUrl)
    ) {
      const { parseYouTube } = await import('@/lib/rag/ingestion/parsers/youtube');
      const ytResult = await parseYouTube(metadata.sourceUrl);
      parsedText = ytResult.text;
      await prisma.document.update({ where: { id: documentId }, data: { content: parsedText } });
    } else if (
      document.contentType === 'HTML' &&
      metadata.sourceUrl &&
      typeof metadata.sourceUrl === 'string'
    ) {
      const { scrapeURL } = await import('@/lib/rag/ingestion/parsers/url');
      const scraped = await scrapeURL(metadata.sourceUrl);
      parsedText = scraped.text;
      await prisma.document.update({ where: { id: documentId }, data: { content: parsedText } });
    } else {
      throw new Error('Document has no content');
    }
  }

  await updateJob(job.id, { documentId, progress: 20 });

  // Chunk
  const { ChunkingEngine } = await import('@/lib/rag/chunking');
  const chunks = await ChunkingEngine.chunk(parsedText, {
    strategy: 'fixed',
    chunkSize: document.contentType === 'PDF' ? 1200 : document.contentType === 'MD' ? 1500 : 1000,
    chunkOverlap: 200,
    documentId,
  });

  await updateJob(job.id, { documentId, progress: 40 });

  // Ensure Qdrant collection exists before upserting
  try {
    await ensureDocumentChunksCollection();
  } catch (err) {
    logger.error('Failed to ensure Qdrant collection exists', {
      documentId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Error('Vector database not available — collection could not be created');
  }

  // Embed + store
  const embeddings = createEmbeddings();
  const batchSize = 100;

  const { upsertChunks } = await import('@/lib/qdrant');

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const vectors = await embeddings.embedDocuments(batch.map((c) => c.content));
    const chunkPoints = batch.map((c, j) => ({
      documentId,
      content: c.content,
      embedding: vectors[j],
      index: c.metadata.index,
      start: c.metadata.start,
      end: c.metadata.end,
      page: c.metadata.page ?? null,
      section: c.metadata.headings?.[0] ?? null,
    }));
    const upsertResult = await upsertChunks(chunkPoints, {
      userId: document.userId ?? _userId,
      workspaceId: document.workspaceId ?? undefined,
      documentName: document.name,
      documentType: document.contentType,
    });
    if (upsertResult.failureCount > 0) {
      logger.warn('Some chunks failed to upsert during ingestion', {
        documentId,
        failureCount: upsertResult.failureCount,
        errors: upsertResult.errors,
      });
    }
    const progress = Math.round(50 + ((i + batch.length) / chunks.length) * 45);
    await updateJob(job.id, { documentId, progress });
  }

  // Finalize
  const processingTime = Date.now() - startTime;
  await prisma.document.update({
    where: { id: documentId },
    data: {
      status: 'COMPLETED',
      chunkCount: chunks.length,
      metadata: {
        ...metadata,
        processedAt: new Date().toISOString(),
        processingTimeMs: processingTime,
        totalChunks: chunks.length,
      },
    },
  });
  await prisma.ingestionJob
    .upsert({
      where: { id: job.id },
      update: { status: 'COMPLETED', progress: 100, completedAt: new Date() },
      create: {
        id: job.id,
        documentId,
        status: 'COMPLETED',
        progress: 100,
        completedAt: new Date(),
      },
    })
    .catch(() => {});

  logger.info('Document processed directly', {
    documentId,
    chunkCount: chunks.length,
    processingTimeMs: processingTime,
  });

  return { success: true, chunkCount: chunks.length, processingTimeMs: processingTime };
}
