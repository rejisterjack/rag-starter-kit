/**
 * Export Service
 * Main service for exporting conversations to various formats
 * Supports single and batch exports with progress tracking
 */

import { Readable } from 'node:stream';
import archiver from 'archiver';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';

// Prisma types - will be generated after prisma generate
// type DBMessage = import('@prisma/client').Message;
// type Chat = import('@prisma/client').Chat;
// type MessageRole = import('@prisma/client').MessageRole;

import { MarkdownGenerator } from './markdown-generator';
import { type PDFGenerationOptions, PDFGenerator } from './pdf-generator';
import { ExportStorage, generateExportFilename } from './storage';
import type {
  BulkExportOptions,
  ExportCitation,
  ExportConversation,
  ExportJob,
  ExportOptions,
  ExportProgress,
  ExportResult,
  ExportSource,
} from './types';
import { WordGenerator } from './word-generator';

// =============================================================================
// Types
// =============================================================================

export type {
  BulkExportOptions,
  ExportConversation,
  ExportJob,
  ExportOptions,
  ExportProgress,
  ExportResult,
};

export interface ExportServiceConfig {
  storage?: ExportStorage;
  maxConcurrentJobs?: number;
  defaultExpiryHours?: number;
  enableAuditLogging?: boolean;
}

// =============================================================================
// Export Service Class
// =============================================================================

export class ExportService {
  private storage: ExportStorage;
  private jobs: Map<string, ExportJob>;
  private maxConcurrentJobs: number;
  private defaultExpiryHours: number;
  private enableAuditLogging: boolean;
  private activeJobs: Set<string>;

  constructor(config: ExportServiceConfig = {}) {
    this.storage = config.storage ?? new ExportStorage();
    this.jobs = new Map();
    this.maxConcurrentJobs = config.maxConcurrentJobs ?? 5;
    this.defaultExpiryHours = config.defaultExpiryHours ?? 24;
    this.enableAuditLogging = config.enableAuditLogging ?? true;
    this.activeJobs = new Set();

    // Initialize storage
    // biome-ignore lint/suspicious/noConsole: Initialization error should be logged
    this.storage.initialize().catch(console.error);
  }

  /**
   * Export a single chat to the specified format
   */
  async exportChat(
    chatId: string,
    options: ExportOptions,
    userId: string,
    workspaceId?: string
  ): Promise<ExportResult> {
    const jobId = crypto.randomUUID();

    try {
      // Check concurrent job limit
      if (this.activeJobs.size >= this.maxConcurrentJobs) {
        throw new ExportServiceError(
          'Maximum concurrent exports reached. Please try again later.',
          'RATE_LIMIT'
        );
      }

      // Create job
      const job: ExportJob = {
        id: jobId,
        userId,
        workspaceId,
        status: 'pending',
        format: options.format,
        progress: 0,
        currentStep: 'Initializing...',
        totalItems: 0,
        processedItems: 0,
        expiresAt: new Date(Date.now() + this.defaultExpiryHours * 60 * 60 * 1000),
        createdAt: new Date(),
      };

      this.jobs.set(jobId, job);
      this.activeJobs.add(jobId);

      // Update job status
      this.updateJob(jobId, { status: 'processing', currentStep: 'Fetching conversation...' });

      // Fetch conversation data
      const conversation = await this.fetchConversation(chatId);

      if (!conversation) {
        throw new ExportServiceError('Conversation not found', 'NOT_FOUND');
      }

      // Verify access
      if (conversation.userId !== userId && conversation.workspaceId !== workspaceId) {
        throw new ExportServiceError('Access denied', 'FORBIDDEN');
      }

      this.updateJob(jobId, {
        totalItems: conversation.messages.length,
        currentStep: 'Generating export...',
      });

      // Extract citations from messages
      const citations = this.extractCitations(conversation);

      // Generate export based on format
      const { buffer, mimeType } = await this.generateExport(
        conversation,
        options,
        citations,
        (progress) => this.updateJob(jobId, progress)
      );

      // Store file
      this.updateJob(jobId, { currentStep: 'Saving file...', progress: 90 });

      const filename = generateExportFilename(options.format, conversation.title);
      const storedFile = await this.storage.storeFile(buffer, {
        filename,
        mimeType,
        expiresInHours: this.defaultExpiryHours,
      });

      // Update job with completion
      const downloadUrl = await this.storage.getDownloadUrl(storedFile.key);

      this.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Complete',
        processedItems: conversation.messages.length,
        filePath: storedFile.path,
        fileSize: storedFile.size,
        downloadUrl: downloadUrl ?? undefined,
      });

      // Log audit event
      if (this.enableAuditLogging) {
        await logAuditEvent({
          event: AuditEvent.CHAT_MESSAGE_SENT,
          userId,
          workspaceId,
          metadata: {
            action: 'export',
            chatId,
            format: options.format,
            jobId,
            fileSize: storedFile.size,
          },
        });
      }

      this.activeJobs.delete(jobId);

      return {
        success: true,
        jobId,
        filePath: storedFile.path,
        fileSize: storedFile.size,
        downloadUrl: downloadUrl ?? undefined,
        expiresAt: job.expiresAt,
      };
    } catch (error) {
      this.activeJobs.delete(jobId);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateJob(jobId, {
        status: 'failed',
        error: errorMessage,
        currentStep: 'Failed',
      });

      // Log error
      if (this.enableAuditLogging) {
        await logAuditEvent({
          event: AuditEvent.CHAT_MESSAGE_SENT,
          userId,
          workspaceId,
          severity: 'ERROR',
          metadata: {
            action: 'export',
            chatId,
            format: options.format,
            jobId,
            error: errorMessage,
          },
        });
      }

      if (error instanceof ExportServiceError) {
        throw error;
      }

      throw new ExportServiceError(`Export failed: ${errorMessage}`, 'INTERNAL_ERROR');
    }
  }

  /**
   * Export multiple conversations in bulk
   */
  async exportConversations(
    options: BulkExportOptions,
    userId: string,
    workspaceId?: string
  ): Promise<ExportResult> {
    const jobId = crypto.randomUUID();

    try {
      if (this.activeJobs.size >= this.maxConcurrentJobs) {
        throw new ExportServiceError(
          'Maximum concurrent exports reached. Please try again later.',
          'RATE_LIMIT'
        );
      }

      const job: ExportJob = {
        id: jobId,
        userId,
        workspaceId,
        status: 'pending',
        format: options.format,
        progress: 0,
        currentStep: 'Initializing...',
        totalItems: 0,
        processedItems: 0,
        expiresAt: new Date(Date.now() + this.defaultExpiryHours * 60 * 60 * 1000),
        createdAt: new Date(),
      };

      this.jobs.set(jobId, job);
      this.activeJobs.add(jobId);

      this.updateJob(jobId, { status: 'processing', currentStep: 'Fetching conversations...' });

      // Fetch conversations
      const conversations = await this.fetchConversations(options, userId, workspaceId);

      if (conversations.length === 0) {
        throw new ExportServiceError('No conversations found matching criteria', 'NOT_FOUND');
      }

      this.updateJob(jobId, {
        totalItems: conversations.length,
        currentStep: 'Generating exports...',
      });

      // Process each conversation
      const buffers: { name: string; buffer: Buffer }[] = [];

      for (let i = 0; i < conversations.length; i++) {
        const conversation = conversations[i];
        const citations = this.extractCitations(conversation);

        const { buffer } = await this.generateExport(
          conversation,
          options,
          citations,
          (progress) => {
            this.updateJob(jobId, {
              progress:
                Math.round((i / conversations.length) * 70) + Math.round(progress.progress * 0.7),
              currentStep: `Processing conversation ${i + 1} of ${conversations.length}...`,
              processedItems: i,
            });
          }
        );

        const filename = generateExportFilename(options.format, conversation.title);
        buffers.push({ name: filename, buffer });
      }

      // Create ZIP archive
      this.updateJob(jobId, { currentStep: 'Creating archive...', progress: 80 });

      const zipBuffer = await this.createZipArchive(buffers);

      // Store archive
      this.updateJob(jobId, { currentStep: 'Saving archive...', progress: 90 });

      const zipFilename = `export-${new Date().toISOString().split('T')[0]}.zip`;
      const storedFile = await this.storage.storeFile(zipBuffer, {
        filename: zipFilename,
        mimeType: 'application/zip',
        expiresInHours: this.defaultExpiryHours,
      });

      const downloadUrl = await this.storage.getDownloadUrl(storedFile.key);

      this.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        currentStep: 'Complete',
        processedItems: conversations.length,
        filePath: storedFile.path,
        fileSize: storedFile.size,
        downloadUrl: downloadUrl ?? undefined,
      });

      // Log audit event
      if (this.enableAuditLogging) {
        await logAuditEvent({
          event: AuditEvent.CHAT_MESSAGE_SENT,
          userId,
          workspaceId,
          metadata: {
            action: 'bulk_export',
            conversationCount: conversations.length,
            format: options.format,
            jobId,
            fileSize: storedFile.size,
          },
        });
      }

      this.activeJobs.delete(jobId);

      return {
        success: true,
        jobId,
        filePath: storedFile.path,
        fileSize: storedFile.size,
        downloadUrl: downloadUrl ?? undefined,
        expiresAt: job.expiresAt,
      };
    } catch (error) {
      this.activeJobs.delete(jobId);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.updateJob(jobId, {
        status: 'failed',
        error: errorMessage,
        currentStep: 'Failed',
      });

      if (error instanceof ExportServiceError) {
        throw error;
      }

      throw new ExportServiceError(`Bulk export failed: ${errorMessage}`, 'INTERNAL_ERROR');
    }
  }

  /**
   * Get export job status
   */
  getJobStatus(jobId: string): ExportJob | null {
    return this.jobs.get(jobId) ?? null;
  }

  /**
   * Get all jobs for a user
   */
  getUserJobs(userId: string): ExportJob[] {
    return Array.from(this.jobs.values()).filter((job) => job.userId === userId);
  }

  /**
   * Cancel an export job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);

    if (!job) return false;
    if (job.status === 'completed' || job.status === 'failed') return false;

    this.updateJob(jobId, {
      status: 'cancelled',
      currentStep: 'Cancelled by user',
    });

    this.activeJobs.delete(jobId);

    return true;
  }

  /**
   * Clean up old jobs
   */
  async cleanupOldJobs(maxAgeHours = 48): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [jobId, job] of this.jobs) {
      if (job.createdAt < cutoff) {
        this.jobs.delete(jobId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Stream export file
   */
  async streamExport(jobId: string): Promise<Readable | null> {
    const job = this.jobs.get(jobId);

    if (!job || job.status !== 'completed' || !job.filePath) {
      return null;
    }

    // Get file from storage
    const buffer = await this.storage.retrieveFile(jobId);
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    return readable;
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private async fetchConversation(chatId: string): Promise<ExportConversation | null> {
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        workspace: true,
        user: {
          select: { name: true },
        },
      },
    });

    if (!chat) return null;

    return this.transformToExportConversation(chat);
  }

  private async fetchConversations(
    options: BulkExportOptions,
    userId: string,
    workspaceId?: string
  ): Promise<ExportConversation[]> {
    const where: Record<string, unknown> = {};

    if (options.chatIds && options.chatIds.length > 0) {
      where.id = { in: options.chatIds };
    } else {
      // Build query based on filters
      const orConditions: Record<string, unknown>[] = [{ userId }];

      if (workspaceId) {
        orConditions.push({ workspaceId });
      }

      where.OR = orConditions;

      if (options.dateRange) {
        where.createdAt = {
          gte: options.dateRange.start,
          lte: options.dateRange.end,
        };
      }

      if (options.workspaceId) {
        where.workspaceId = options.workspaceId;
      }
    }

    const chats = await prisma.chat.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        workspace: true,
        user: {
          select: { name: true },
        },
      },
      take: 100, // Limit bulk export
    });

    return chats.map((chat: unknown) =>
      this.transformToExportConversation(
        chat as Parameters<typeof this.transformToExportConversation>[0]
      )
    );
  }

  private transformToExportConversation(chat: {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    workspaceId: string | null;
    userId: string | null;
    messages: Array<{
      id: string;
      content: string;
      role: string;
      createdAt: Date;
      chatId: string;
      sources?: unknown;
      tokensUsed?: unknown;
    }>;
    workspace?: { name: string } | null;
    user?: { name: string | null } | null;
  }): ExportConversation {
    return {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      workspaceId: chat.workspaceId ?? undefined,
      workspaceName: chat.workspace?.name,
      userName: chat.user?.name ?? undefined,
      messages: chat.messages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        role: this.mapRole(msg.role),
        createdAt: msg.createdAt,
        sources: msg.sources ? this.transformSources(msg.sources as SourceData[]) : undefined,
        tokensUsed: msg.tokensUsed as Record<string, number> | undefined,
      })),
    };
  }

  private mapRole(role: string): 'user' | 'assistant' | 'system' {
    switch (role) {
      case 'USER':
        return 'user';
      case 'ASSISTANT':
        return 'assistant';
      case 'SYSTEM':
        return 'system';
      default:
        return 'user';
    }
  }

  private transformSources(sources: SourceData[]): ExportSource[] {
    return sources.map((source) => ({
      id: source.id,
      content: source.content,
      documentId: source.metadata.documentId,
      documentName: source.metadata.documentName,
      page: source.metadata.page,
      chunkIndex: source.metadata.chunkIndex,
      similarity: source.similarity,
    }));
  }

  private extractCitations(conversation: ExportConversation): ExportCitation[] {
    const citations: ExportCitation[] = [];
    const seen = new Set<string>();

    for (const message of conversation.messages) {
      if (!message.sources) continue;

      for (const source of message.sources) {
        const key = `${source.documentId}-${source.page ?? 'nopage'}`;
        if (seen.has(key)) continue;

        seen.add(key);
        citations.push({
          id: `[${citations.length + 1}]`,
          chunkId: source.id,
          documentId: source.documentId,
          documentName: source.documentName,
          page: source.page,
          content: source.content,
          score: source.similarity ?? 0,
        });
      }
    }

    return citations;
  }

  private async generateExport(
    conversation: ExportConversation,
    options: ExportOptions,
    citations: ExportCitation[],
    onProgress: (progress: Omit<ExportProgress, 'jobId' | 'status'>) => void
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    switch (options.format) {
      case 'pdf': {
        const generator = new PDFGenerator(options as PDFGenerationOptions, (p) =>
          onProgress({
            progress: p.progress,
            currentStep: p.currentStep,
            processedItems: p.processedItems,
            totalItems: p.totalItems,
          })
        );
        const buffer = await generator.generate(conversation, citations);
        return { buffer, mimeType: 'application/pdf' };
      }

      case 'word': {
        const generator = new WordGenerator(options, (p) =>
          onProgress({
            progress: p.progress,
            currentStep: p.currentStep,
            processedItems: p.processedItems,
            totalItems: p.totalItems,
          })
        );
        const buffer = await generator.generate(conversation, citations);
        return {
          buffer,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        };
      }

      case 'markdown': {
        const generator = new MarkdownGenerator(options, (p) =>
          onProgress({
            progress: p.progress,
            currentStep: p.currentStep,
            processedItems: p.processedItems,
            totalItems: p.totalItems,
          })
        );
        const content = await generator.generate(conversation, citations);
        return { buffer: Buffer.from(content, 'utf-8'), mimeType: 'text/markdown' };
      }

      default:
        throw new ExportServiceError(
          `Unsupported export format: ${options.format}`,
          'VALIDATION_ERROR'
        );
    }
  }

  private async createZipArchive(files: { name: string; buffer: Buffer }[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      for (const file of files) {
        archive.append(file.buffer, { name: file.name });
      }

      archive.finalize();
    });
  }

  private updateJob(
    jobId: string,
    updates: Partial<ExportJob> | Omit<ExportProgress, 'jobId'>
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    Object.assign(job, updates);
    this.jobs.set(jobId, job);
  }
}

// =============================================================================
// Source Data Type
// =============================================================================

interface SourceData {
  id: string;
  content: string;
  metadata: {
    documentId: string;
    documentName: string;
    page?: number;
    chunkIndex: number;
    totalChunks: number;
  };
  similarity?: number;
}

// =============================================================================
// Error Class
// =============================================================================

export class ExportServiceError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'ExportServiceError';
    this.code = code;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let exportServiceInstance: ExportService | null = null;

export function getExportService(config?: ExportServiceConfig): ExportService {
  if (!exportServiceInstance) {
    exportServiceInstance = new ExportService(config);
  }
  return exportServiceInstance;
}

export function resetExportService(): void {
  exportServiceInstance = null;
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Quick export a chat to PDF
 */
export async function quickExportPDF(
  chatId: string,
  userId: string,
  workspaceId?: string
): Promise<ExportResult> {
  const service = getExportService();
  return service.exportChat(chatId, { format: 'pdf', includeCitations: true }, userId, workspaceId);
}

/**
 * Quick export a chat to Word
 */
export async function quickExportWord(
  chatId: string,
  userId: string,
  workspaceId?: string
): Promise<ExportResult> {
  const service = getExportService();
  return service.exportChat(
    chatId,
    { format: 'word', includeCitations: true },
    userId,
    workspaceId
  );
}

/**
 * Quick export a chat to Markdown
 */
export async function quickExportMarkdown(
  chatId: string,
  userId: string,
  workspaceId?: string
): Promise<ExportResult> {
  const service = getExportService();
  return service.exportChat(
    chatId,
    { format: 'markdown', includeCitations: true },
    userId,
    workspaceId
  );
}
