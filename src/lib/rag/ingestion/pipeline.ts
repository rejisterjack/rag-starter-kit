/**
 * Document Ingestion Pipeline
 * 
 * Orchestrates the full document processing workflow:
 * 1. Validate - Check file size, type, virus scan placeholder
 * 2. Parse - Extract text based on document type
 * 3. Chunk - Apply chunking strategy (semantic/hierarchical)
 * 4. Embed - Generate embeddings for each chunk
 * 5. Store - Save to database with vector insertion
 */

import { ChunkingEngine } from '@/lib/rag/chunking';
import { createEmbeddings } from '@/lib/rag/engine';
import { prisma } from '@/lib/db';

import { parsePDF } from './parsers/pdf';
import { parseDOCX } from './parsers/docx';
import { parseText } from './parsers/txt';
import { parseHTML } from './parsers/html';
import { scrapeURL } from './parsers/url';

// =============================================================================
// Types
// =============================================================================

export type DocumentType = 'PDF' | 'DOCX' | 'TXT' | 'MD' | 'HTML' | 'URL';

export interface IngestionInput {
  file?: File;
  url?: string;
  type: DocumentType;
  workspaceId: string;
  metadata?: Record<string, unknown>;
}

export interface IngestionResult {
  documentId: string;
  chunkCount: number;
  tokenCount: number;
  processingTimeMs: number;
}

export interface IngestionError {
  stage: 'validate' | 'parse' | 'chunk' | 'embed' | 'store';
  message: string;
  recoverable: boolean;
  originalError?: Error;
}

export interface PipelineProgress {
  stage: 'validate' | 'parse' | 'chunk' | 'embed' | 'store' | 'complete';
  progress: number; // 0-100
  message: string;
}

export type ProgressCallback = (progress: PipelineProgress) => void | Promise<void>;

export interface PipelineOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  maxFileSize?: number; // bytes
  allowedTypes?: DocumentType[];
  enableVirusScan?: boolean; // placeholder
  retryAttempts?: number;
  retryDelay?: number; // ms
  onProgress?: ProgressCallback;
}

export interface ParsedDocument {
  type: DocumentType;
  content: string;
  metadata: Record<string, unknown>;
  pages?: Array<{ pageNumber: number; text: string }>;
  paragraphs?: Array<{ text: string; isHeading?: boolean; headingLevel?: number }>;
  sourceUrl?: string;
}

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_OPTIONS: Required<PipelineOptions> = {
  chunkSize: 1000,
  chunkOverlap: 200,
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedTypes: ['PDF', 'DOCX', 'TXT', 'MD', 'HTML', 'URL'],
  enableVirusScan: false,
  retryAttempts: 3,
  retryDelay: 1000,
  onProgress: () => {},
};

// MIME type to DocumentType mapping
const MIME_TYPE_MAP: Record<string, DocumentType> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'text/plain': 'TXT',
  'text/markdown': 'MD',
  'text/x-markdown': 'MD',
  'text/html': 'HTML',
  'application/xhtml+xml': 'HTML',
};

// File extension to DocumentType mapping
const EXTENSION_MAP: Record<string, DocumentType> = {
  'pdf': 'PDF',
  'docx': 'DOCX',
  'txt': 'TXT',
  'md': 'MD',
  'markdown': 'MD',
  'html': 'HTML',
  'htm': 'HTML',
};

// =============================================================================
// Ingestion Pipeline Class
// =============================================================================

export class IngestionPipeline {
  private options: Required<PipelineOptions>;
  private deadLetterQueue: Array<{ input: IngestionInput; error: IngestionError }> = [];

  constructor(options: PipelineOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Process a document through the full pipeline
   */
  async process(input: IngestionInput): Promise<IngestionResult> {
    const startTime = Date.now();


    try {
      // Stage 1: Validate
      await this.reportProgress('validate', 0, 'Validating input...');
      const validated = await this.validate(input);
      await this.reportProgress('validate', 100, 'Validation complete');

      // Stage 2: Parse
      await this.reportProgress('parse', 0, 'Parsing document...');
      const parsed = await this.withRetry(() => this.parse(validated), 'parse');
      await this.reportProgress('parse', 100, 'Parsing complete');

      // Stage 3: Chunk
      await this.reportProgress('chunk', 0, 'Creating chunks...');
      const chunks = await this.withRetry(() => this.chunk(parsed, input.workspaceId), 'chunk');
      await this.reportProgress('chunk', 100, `${chunks.length} chunks created`);

      // Stage 4: Embed
      await this.reportProgress('embed', 0, 'Generating embeddings...');
      const chunksWithEmbeddings = await this.withRetry(() => this.embed(chunks), 'embed');
      await this.reportProgress('embed', 100, 'Embeddings generated');

      // Stage 5: Store
      await this.reportProgress('store', 0, 'Storing in database...');
      const documentId = await this.withRetry(
        () => this.store(chunksWithEmbeddings, parsed, input),
        'store'
      );
      await this.reportProgress('store', 100, 'Storage complete');

      // Complete
      await this.reportProgress('complete', 100, 'Processing complete');

      return {
        documentId,
        chunkCount: chunks.length,
        tokenCount: this.estimateTokens(chunks.map(c => c.content)),
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const ingestionError = this.normalizeError(error);
      
      // Add to dead letter queue if not recoverable
      if (!ingestionError.recoverable) {
        this.deadLetterQueue.push({ input, error: ingestionError });
      }

      throw ingestionError;
    }
  }

  /**
   * Stage 1: Validate input
   */
  private async validate(input: IngestionInput): Promise<{ buffer: Buffer; type: DocumentType; filename?: string }> {
    // Validate document type
    if (!this.options.allowedTypes.includes(input.type)) {
      throw this.createError('validate', `Document type '${input.type}' not allowed`, false);
    }

    // Handle URL input
    if (input.type === 'URL' && input.url) {
      // URL validation happens during parsing
      return { buffer: Buffer.from(''), type: 'URL' };
    }

    // Handle file input
    if (!input.file) {
      throw this.createError('validate', 'No file provided', false);
    }

    // Validate file size
    if (input.file.size > this.options.maxFileSize) {
      throw this.createError(
        'validate',
        `File size (${this.formatBytes(input.file.size)}) exceeds limit (${this.formatBytes(this.options.maxFileSize)})`,
        false
      );
    }

    // Validate file type matches extension
    const detectedType = this.detectDocumentType(input.file.name);
    if (detectedType !== input.type) {
      throw this.createError(
        'validate',
        `File extension does not match declared type: ${input.type} vs ${detectedType}`,
        false
      );
    }

    // Virus scan placeholder
    if (this.options.enableVirusScan) {
      // TODO: Implement virus scanning
      console.log('Virus scan placeholder - would scan file here');
    }

    // Convert to buffer
    const bytes = await input.file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    return { buffer, type: input.type, filename: input.file.name };
  }

  /**
   * Stage 2: Parse document
   */
  private async parse(validated: { buffer: Buffer; type: DocumentType; filename?: string }): Promise<ParsedDocument> {
    const { buffer, type, filename } = validated;

    switch (type) {
      case 'PDF': {
        const parsed = await parsePDF(buffer);
        return {
          type: 'PDF',
          content: parsed.text,
          metadata: {
            ...parsed.metadata,
            filename,
            totalCharacters: parsed.totalCharacters,
          },
          pages: parsed.pages,
        };
      }

      case 'DOCX': {
        const parsed = await parseDOCX(buffer);
        return {
          type: 'DOCX',
          content: parsed.text,
          metadata: {
            ...parsed.metadata,
            filename,
            wordCount: parsed.wordCount,
            characterCount: parsed.characterCount,
          },
          paragraphs: parsed.paragraphs.map(p => ({
            text: p.text,
            isHeading: p.isHeading,
            headingLevel: p.headingLevel,
          })),
        };
      }

      case 'TXT':
      case 'MD': {
        const parsed = parseText(buffer, { detectEncoding: true });
        return {
          type,
          content: parsed.text,
          metadata: {
            filename,
            encoding: parsed.encoding,
            lineCount: parsed.lineCount,
            wordCount: parsed.wordCount,
            characterCount: parsed.characterCount,
          },
        };
      }

      case 'HTML': {
        const parsed = parseHTML(buffer);
        return {
          type: 'HTML',
          content: parsed.text,
          metadata: {
            ...parsed.metadata,
            filename,
            wordCount: parsed.wordCount,
            characterCount: parsed.characterCount,
          },
        };
      }

      default:
        throw this.createError('parse', `Unsupported document type: ${type}`, false);
    }
  }

  /**
   * Parse URL content
   */
  async parseURL(url: string): Promise<ParsedDocument> {
    const scraped = await scrapeURL(url, {
      extractMainContent: true,
      waitForNetworkIdle: true,
      scrollToBottom: false,
    });

    return {
      type: 'URL',
      content: scraped.text,
      metadata: {
        ...scraped.metadata,
        sourceUrl: scraped.finalUrl,
        scrapedAt: scraped.scrapedAt,
        statusCode: scraped.statusCode,
      },
      sourceUrl: scraped.finalUrl,
    };
  }

  /**
   * Stage 3: Chunk document
   */
  private async chunk(
    parsed: ParsedDocument,
    workspaceId: string
  ): Promise<Array<{ content: string; metadata: Record<string, unknown>; workspaceId: string }>> {
    // Use pipeline options or defaults
    const chunkSize = this.options.chunkSize ?? 1000;
    const chunkOverlap = this.options.chunkOverlap ?? 200;

    // Create chunks using ChunkingEngine
    const chunks = await ChunkingEngine.chunk(parsed.content, {
      strategy: 'fixed',
      chunkSize,
      chunkOverlap,
      documentId: 'temp',
    });

    // Enhance chunk metadata
    return chunks.map((chunk, index) => {
      const metadata: Record<string, unknown> = {
        ...chunk.metadata,
        chunkIndex: index,
        totalChunks: chunks.length,
        documentType: parsed.type,
      };

      // Add page information for PDFs
      if (parsed.type === 'PDF' && parsed.pages) {
        const pageInfo = this.findPageForChunk(parsed.pages, chunk.metadata.start ?? 0);
        if (pageInfo) {
          metadata.page = pageInfo.pageNumber;
        }
      }

      // Add section information for DOCX
      if (parsed.type === 'DOCX' && parsed.paragraphs) {
        const section = this.findSectionForChunk(parsed.paragraphs, chunk.content);
        if (section) {
          metadata.section = section;
        }
      }

      return {
        content: chunk.content,
        metadata,
        workspaceId,
      };
    });
  }

  /**
   * Stage 4: Generate embeddings
   */
  private async embed(
    chunks: Array<{ content: string; metadata: Record<string, unknown>; workspaceId: string }>
  ): Promise<Array<{ content: string; metadata: Record<string, unknown>; embedding: number[]; workspaceId: string }>> {
    const embeddings = createEmbeddings();

    // Process in batches to avoid rate limits
    const batchSize = 20;
    const results: Array<{ content: string; metadata: Record<string, unknown>; embedding: number[]; workspaceId: string }> = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const contents = batch.map(c => c.content);

      // Generate embeddings for batch
      const vectors = await embeddings.embedDocuments(contents);

      // Combine with metadata
      for (let j = 0; j < batch.length; j++) {
        results.push({
          ...batch[j],
          embedding: vectors[j],
        });
      }

      // Report progress
      const progress = Math.round(((i + batch.length) / chunks.length) * 100);
      await this.reportProgress('embed', progress, `Embedded ${i + batch.length}/${chunks.length} chunks`);
    }

    return results;
  }

  /**
   * Stage 5: Store in database
   */
  private async store(
    chunks: Array<{ content: string; metadata: Record<string, unknown>; embedding: number[]; workspaceId: string }>,
    parsed: ParsedDocument,
    input: IngestionInput
  ): Promise<string> {
    // Create document record
    const document = await prisma.document.create({
      data: {
        name: input.file?.name || parsed.sourceUrl || 'Untitled',
        contentType: parsed.type,
        size: input.file?.size || 0,
        status: 'PROCESSING',
        userId: input.workspaceId, // Using workspaceId as userId for now
        content: parsed.content,
        metadata: {
          ...parsed.metadata,
          ...input.metadata,
        },
      },
    });

    // Create chunks with embeddings using raw SQL for vector support
    const batchSize = 50;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      for (const chunk of batch) {
        await prisma.$executeRaw`
          INSERT INTO document_chunks (
            id, document_id, content, embedding, index, start, "end", page, section, created_at
          ) VALUES (
            ${crypto.randomUUID()},
            ${document.id},
            ${chunk.content},
            ${chunk.embedding}::vector,
            ${(chunk.metadata.chunkIndex as number) ?? 0},
            ${(chunk.metadata.start as number) ?? 0},
            ${(chunk.metadata.end as number) ?? 0},
            ${(chunk.metadata.page as number) ?? null},
            ${(chunk.metadata.section as string) ?? null},
            NOW()
          )
        `;
      }

      // Report progress
      const progress = Math.round(((i + batch.length) / chunks.length) * 100);
      await this.reportProgress('store', progress, `Stored ${i + batch.length}/${chunks.length} chunks`);
    }

    // Update document status
    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: 'COMPLETED',
        chunkCount: chunks.length,
      },
    });

    return document.id;
  }

  /**
   * Retry logic with exponential backoff
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    stage: IngestionError['stage']
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.options.retryAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if error is recoverable
        if (!this.isRecoverableError(lastError, stage)) {
          throw this.createError(stage, lastError.message, false, lastError);
        }

        // Wait before retry with exponential backoff
        if (attempt < this.options.retryAttempts - 1) {
          const delay = this.options.retryDelay * Math.pow(2, attempt);
          await sleep(delay);
        }
      }
    }

    throw this.createError(
      stage,
      `Failed after ${this.options.retryAttempts} attempts: ${lastError?.message}`,
      false,
      lastError
    );
  }

  /**
   * Check if an error is recoverable
   */
  private isRecoverableError(error: Error, stage: IngestionError['stage']): boolean {
    // Network errors are typically recoverable
    if (error.message.includes('ECONNREFUSED') || 
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ENOTFOUND')) {
      return true;
    }

    // Rate limiting is recoverable
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return true;
    }

    // Parsing errors are typically not recoverable
    if (stage === 'parse') {
      return false;
    }

    // Validation errors are not recoverable
    if (stage === 'validate') {
      return false;
    }

    // Default to recoverable for other stages
    return true;
  }

  /**
   * Report progress through callback
   */
  private async reportProgress(
    stage: PipelineProgress['stage'],
    progress: number,
    message: string
  ): Promise<void> {
    try {
      await this.options.onProgress({ stage, progress, message });
    } catch (error) {
      console.error('Progress callback error:', error);
    }
  }

  /**
   * Create standardized error
   */
  private createError(
    stage: IngestionError['stage'],
    message: string,
    recoverable: boolean,
    originalError?: Error
  ): IngestionError {
    return {
      stage,
      message,
      recoverable,
      originalError,
    };
  }

  /**
   * Normalize unknown error to IngestionError
   */
  private normalizeError(error: unknown): IngestionError {
    if (this.isIngestionError(error)) {
      return error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      stage: 'parse',
      message,
      recoverable: false,
      originalError: error instanceof Error ? error : undefined,
    };
  }

  /**
   * Type guard for IngestionError
   */
  private isIngestionError(error: unknown): error is IngestionError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'stage' in error &&
      'message' in error &&
      'recoverable' in error
    );
  }

  /**
   * Detect document type from filename
   */
  private detectDocumentType(filename: string): DocumentType {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return EXTENSION_MAP[ext] || 'TXT';
  }

  /**
   * Map pipeline DocumentType to chunking DocumentType
   */
  // private _mapToDocumentType(type: DocumentType): import('@/types').DocumentType {
  //   switch (type) {
  //     case 'PDF': return 'pdf';
  //     case 'DOCX': return 'docx';
  //     case 'TXT': return 'txt';
  //     case 'MD': return 'md';
  //     case 'HTML': return 'html';
  //     default: return 'txt';
  //   }
  // }

  /**
   * Find which page a chunk belongs to
   */
  private findPageForChunk(
    pages: Array<{ pageNumber: number; text: string }>,
    charPosition: number
  ): { pageNumber: number } | null {
    let cumulativeLength = 0;
    
    for (const page of pages) {
      cumulativeLength += page.text.length + 2; // +2 for \n\n separator
      if (charPosition < cumulativeLength) {
        return { pageNumber: page.pageNumber };
      }
    }
    
    return null;
  }

  /**
   * Find section heading for a chunk
   */
  private findSectionForChunk(
    paragraphs: Array<{ text: string; isHeading?: boolean; headingLevel?: number }>,
    _chunkContent: string
  ): string | null {
    // Find the most recent heading before this chunk content
    for (let i = paragraphs.length - 1; i >= 0; i--) {
      if (paragraphs[i].isHeading) {
        return paragraphs[i].text.slice(0, 200);
      }
    }
    return null;
  }

  /**
   * Estimate token count for chunks
   */
  private estimateTokens(contents: string[]): number {
    // Rough estimation: ~0.75 tokens per word, ~4 characters per token
    const totalChars = contents.join('').length;
    return Math.ceil(totalChars / 4);
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Get items in dead letter queue
   */
  getDeadLetterQueue(): Array<{ input: IngestionInput; error: IngestionError }> {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): void {
    this.deadLetterQueue = [];
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Singleton Export
// =============================================================================

export const ingestionPipeline = new IngestionPipeline();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Process a document with the default pipeline
 */
export async function processDocument(
  input: IngestionInput,
  options?: PipelineOptions
): Promise<IngestionResult> {
  const pipeline = new IngestionPipeline(options);
  return pipeline.process(input);
}

/**
 * Process a URL document
 */
export async function processURL(
  url: string,
  workspaceId: string,
  options?: PipelineOptions
): Promise<IngestionResult> {
  const pipeline = new IngestionPipeline(options);
  const parsed = await pipeline.parseURL(url);
  
  return pipeline.process({
    type: 'URL',
    url,
    workspaceId,
    metadata: parsed.metadata,
  });
}

/**
 * Detect document type from various sources
 */
export function detectDocumentType(source: string | File): DocumentType {
  if (source instanceof File) {
    // Try MIME type first
    const mimeType = source.type;
    if (MIME_TYPE_MAP[mimeType]) {
      return MIME_TYPE_MAP[mimeType];
    }
    
    // Fall back to extension
    return EXTENSION_MAP[source.name.split('.').pop()?.toLowerCase() || ''] || 'TXT';
  }

  // URL detection
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return 'URL';
  }

  // Path/extension detection
  return EXTENSION_MAP[source.split('.').pop()?.toLowerCase() || ''] || 'TXT';
}

/**
 * Check if document type is supported
 */
export function isSupportedDocumentType(type: string): type is DocumentType {
  return ['PDF', 'DOCX', 'TXT', 'MD', 'HTML', 'URL'].includes(type);
}
