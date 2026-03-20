/**
 * Document Tools
 *
 * Tools for searching and summarizing documents.
 * Used by ReAct agents and other agentic components.
 */

import { z } from 'zod';
import { createProviderFromEnv } from '@/lib/ai/llm';
import { prisma } from '@/lib/db';
import type { Source } from '@/types';
import { buildContext, generateQueryEmbedding, retrieveSources } from '../retrieval';
import { createErrorResult, createSuccessResult, createTool } from './types';

// ============================================================================
// Search Documents Tool
// ============================================================================

const SearchDocumentsParamsSchema = z.object({
  query: z.string().describe('The search query to find relevant documents'),
  topK: z.number().optional().describe('Number of results to return (default: 5)'),
  documentIds: z.array(z.string()).optional().describe('Filter by specific document IDs'),
  workspaceId: z.string().describe('The workspace ID to search within'),
});

type SearchDocumentsParams = z.infer<typeof SearchDocumentsParamsSchema>;

export const searchDocumentsTool = createTool<SearchDocumentsParams>({
  name: 'document_search',
  description: `Search through uploaded documents for relevant information.

Use this when:
- The user asks about content from their documents
- You need to find specific information, quotes, or facts
- The query references "the document", "the report", "the paper", etc.

Returns relevant chunks with their content, source document names, and similarity scores.`,
  parameters: SearchDocumentsParamsSchema,
  execute: async (params) => {
    try {
      const { query, topK = 5, documentIds, workspaceId } = params;

      // Retrieve sources using the existing retrieval system
      const sources = await retrieveSources(query, workspaceId, {
        topK,
        filter: documentIds ? { documentIds } : undefined,
      });

      if (sources.length === 0) {
        return createSuccessResult({
          query,
          found: false,
          message: 'No relevant documents found for this query.',
          results: [],
        });
      }

      // Build context from sources
      const context = buildContext(sources, 4000);

      return createSuccessResult(
        {
          query,
          found: true,
          totalResults: sources.length,
          context,
          results: sources.map((s, index) => ({
            index: index + 1,
            content: s.content,
            documentName: s.metadata.documentName,
            documentId: s.metadata.documentId,
            page: s.metadata.page,
            chunkIndex: s.metadata.chunkIndex,
            similarity: s.similarity,
          })),
        },
        sources
      );
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : 'Document search failed');
    }
  },
});

// ============================================================================
// Get Document Summary Tool
// ============================================================================

const DocumentSummaryParamsSchema = z.object({
  documentId: z.string().describe('The ID of the document to summarize'),
  maxLength: z.number().optional().describe('Maximum length of summary in words (default: 300)'),
  focus: z
    .string()
    .optional()
    .describe('Specific aspect to focus on (e.g., "financial data", "key findings")'),
});

type DocumentSummaryParams = z.infer<typeof DocumentSummaryParamsSchema>;

export const documentSummaryTool = createTool<DocumentSummaryParams>({
  name: 'document_summary',
  description: `Get a summary of a specific document.

Use this when:
- The user asks for a summary, overview, or abstract of a document
- You need to understand the main points of a specific document
- The user references "summarize document X" or "give me an overview"

Returns a concise summary highlighting key points.`,
  parameters: DocumentSummaryParamsSchema,
  execute: async (params) => {
    try {
      const { documentId, maxLength = 300, focus } = params;

      // Get document and its chunks
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          chunks: {
            orderBy: { index: 'asc' },
          },
        },
      });

      if (!document) {
        return createErrorResult(`Document not found: ${documentId}`);
      }

      // Combine chunks for summarization
      const fullText = document.chunks.map((c) => c.content).join('\n\n');

      if (!fullText) {
        return createErrorResult('Document has no content to summarize');
      }

      // Generate summary using LLM
      const llm = createProviderFromEnv();

      const prompt = focus
        ? `Summarize the following document in approximately ${maxLength} words, focusing on: ${focus}\n\nDocument:\n${fullText.slice(0, 8000)}\n\nSummary:`
        : `Provide a comprehensive summary of the following document in approximately ${maxLength} words. Include the main points, key findings, and important details.\n\nDocument:\n${fullText.slice(0, 8000)}\n\nSummary:`;

      const response = await llm.generate(
        [
          {
            role: 'system',
            content:
              'You are a professional document summarizer. Create clear, accurate summaries.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 600 }
      );

      const sources: Source[] = document.chunks.slice(0, 3).map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        metadata: {
          documentId: document.id,
          documentName: document.name,
          page: chunk.page ?? undefined,
          chunkIndex: chunk.index,
          totalChunks: document.chunks.length,
        },
      }));

      return createSuccessResult(
        {
          documentId,
          documentName: document.name,
          summary: response.content.trim(),
          wordCount: response.content.split(/\s+/).length,
          totalChunks: document.chunks.length,
          focus,
        },
        sources
      );
    } catch (error) {
      return createErrorResult(
        error instanceof Error ? error.message : 'Failed to generate summary'
      );
    }
  },
});

// ============================================================================
// Get Document Metadata Tool
// ============================================================================

const DocumentMetadataParamsSchema = z.object({
  documentId: z.string().optional().describe('Specific document ID'),
  workspaceId: z.string().describe('Workspace ID to list documents from'),
});

type DocumentMetadataParams = z.infer<typeof DocumentMetadataParamsSchema>;

export const documentMetadataTool = createTool<DocumentMetadataParams>({
  name: 'document_metadata',
  description: `Get metadata about documents in the workspace.

Use this when:
- The user asks "what documents do I have?" or "list my documents"
- You need to know document names, types, or upload dates
- You need to find a specific document ID

Returns document metadata including names, types, sizes, and status.`,
  parameters: DocumentMetadataParamsSchema,
  execute: async (params) => {
    try {
      const { documentId, workspaceId } = params;

      if (documentId) {
        // Get specific document
        const document = await prisma.document.findFirst({
          where: {
            id: documentId,
            userId: workspaceId, // Note: in real app, join with workspace members
          },
          include: {
            _count: {
              select: { chunks: true },
            },
          },
        });

        if (!document) {
          return createErrorResult(`Document not found: ${documentId}`);
        }

        return createSuccessResult({
          document: {
            id: document.id,
            name: document.name,
            contentType: document.contentType,
            size: document.size,
            status: document.status,
            chunkCount: document._count.chunks,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
            metadata: document.metadata,
          },
        });
      }

      // List all documents in workspace
      const documents = await prisma.document.findMany({
        where: {
          userId: workspaceId, // Note: in real app, join with workspace members
        },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { chunks: true },
          },
        },
      });

      return createSuccessResult({
        totalDocuments: documents.length,
        documents: documents.map((d) => ({
          id: d.id,
          name: d.name,
          contentType: d.contentType,
          size: d.size,
          status: d.status,
          chunkCount: d._count.chunks,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })),
      });
    } catch (error) {
      return createErrorResult(
        error instanceof Error ? error.message : 'Failed to get document metadata'
      );
    }
  },
});

// ============================================================================
// Semantic Search Tool (Advanced)
// ============================================================================

const SemanticSearchParamsSchema = z.object({
  query: z.string().describe('The semantic search query'),
  workspaceId: z.string().describe('The workspace ID'),
  threshold: z.number().optional().describe('Minimum similarity threshold (0-1, default: 0.7)'),
  topK: z.number().optional().describe('Number of results (default: 5)'),
});

type SemanticSearchParams = z.infer<typeof SemanticSearchParamsSchema>;

export const semanticSearchTool = createTool<SemanticSearchParams>({
  name: 'semantic_search',
  description: `Perform semantic search across documents using vector similarity.

This is more powerful than keyword search as it understands meaning and context.
Use this when:
- The user asks conceptual questions
- Keyword search might miss relevant content
- You need to find related concepts even with different wording

Returns semantically similar chunks ranked by relevance.`,
  parameters: SemanticSearchParamsSchema,
  execute: async (params) => {
    try {
      const { query, workspaceId, threshold = 0.7, topK = 5 } = params;

      // Generate embedding for the query
      const queryEmbedding = await generateQueryEmbedding(query);

      // Perform semantic search using raw SQL
      const results = await prisma.$queryRaw<
        Array<{
          id: string;
          document_id: string;
          content: string;
          index: number;
          page: number | null;
          section: string | null;
          document_name: string;
          similarity: number;
        }>
      >`
        SELECT 
          dc.id,
          dc.document_id,
          dc.content,
          dc.index,
          dc.page,
          dc.section,
          d.name as document_name,
          1 - (dc.embedding <=> ${queryEmbedding}::vector) as similarity
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE d.user_id = ${workspaceId}
          AND d.status = 'COMPLETED'
          AND 1 - (dc.embedding <=> ${queryEmbedding}::vector) > ${threshold}
        ORDER BY dc.embedding <=> ${queryEmbedding}::vector
        LIMIT ${topK}
      `;

      const sources: Source[] = results.map((r) => ({
        id: r.id,
        content: r.content,
        similarity: r.similarity,
        metadata: {
          documentId: r.document_id,
          documentName: r.document_name,
          page: r.page ?? undefined,
          chunkIndex: r.index,
          totalChunks: 0,
        },
      }));

      return createSuccessResult(
        {
          query,
          totalResults: results.length,
          threshold,
          results: results.map((r) => ({
            content: r.content,
            documentName: r.document_name,
            documentId: r.document_id,
            page: r.page,
            similarity: r.similarity,
          })),
        },
        sources
      );
    } catch (error) {
      return createErrorResult(error instanceof Error ? error.message : 'Semantic search failed');
    }
  },
});

// ============================================================================
// Compare Documents Tool
// ============================================================================

const CompareDocumentsParamsSchema = z.object({
  documentIds: z.array(z.string()).min(2).describe('Array of document IDs to compare (minimum 2)'),
  aspect: z
    .string()
    .optional()
    .describe('Specific aspect to compare (e.g., "revenue", "findings", "methodology")'),
});

type CompareDocumentsParams = z.infer<typeof CompareDocumentsParamsSchema>;

export const compareDocumentsTool = createTool<CompareDocumentsParams>({
  name: 'compare_documents',
  description: `Compare two or more documents and identify similarities and differences.

Use this when:
- The user asks to "compare" or "contrast" documents
- You need to find differences between versions
- The user wants to see how two reports differ

Returns a comparison analysis with similarities and differences.`,
  parameters: CompareDocumentsParamsSchema,
  execute: async (params) => {
    try {
      const { documentIds, aspect } = params;

      // Get documents
      const documents = await prisma.document.findMany({
        where: { id: { in: documentIds } },
        include: {
          chunks: {
            orderBy: { index: 'asc' },
            take: 20, // Limit chunks for comparison
          },
        },
      });

      if (documents.length !== documentIds.length) {
        const foundIds = documents.map((d) => d.id);
        const missingIds = documentIds.filter((id) => !foundIds.includes(id));
        return createErrorResult(`Documents not found: ${missingIds.join(', ')}`);
      }

      // Build comparison prompt
      const llm = createProviderFromEnv();

      const docTexts = documents.map((d) => ({
        name: d.name,
        id: d.id,
        content: d.chunks
          .map((c) => c.content)
          .join('\n\n')
          .slice(0, 3000),
      }));

      const prompt = aspect
        ? `Compare the following documents focusing on "${aspect}". Identify similarities, differences, and key insights related to this aspect.`
        : 'Compare the following documents. Identify key similarities, differences, and provide an overall analysis.';

      const comparisonPrompt = `${prompt}

${docTexts.map((d) => `--- ${d.name} (${d.id}) ---\n${d.content}`).join('\n\n')}

Comparison Analysis:
1. Similarities:
2. Differences:
3. Key Insights:
${aspect ? `4. Specific findings about "${aspect}":` : ''}`;

      const response = await llm.generate(
        [
          {
            role: 'system',
            content:
              'You are a document comparison expert. Provide structured, detailed comparisons.',
          },
          {
            role: 'user',
            content: comparisonPrompt,
          },
        ],
        { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 1000 }
      );

      const sources: Source[] = documents.flatMap((d) =>
        d.chunks.slice(0, 2).map((chunk) => ({
          id: chunk.id,
          content: chunk.content,
          metadata: {
            documentId: d.id,
            documentName: d.name,
            page: chunk.page ?? undefined,
            chunkIndex: chunk.index,
            totalChunks: d.chunks.length,
          },
        }))
      );

      return createSuccessResult(
        {
          documentIds,
          documentNames: documents.map((d) => d.name),
          aspect,
          comparison: response.content.trim(),
        },
        sources
      );
    } catch (error) {
      return createErrorResult(
        error instanceof Error ? error.message : 'Document comparison failed'
      );
    }
  },
});

// ============================================================================
// Export All Document Tools
// ============================================================================

export const documentTools = [
  searchDocumentsTool,
  documentSummaryTool,
  documentMetadataTool,
  semanticSearchTool,
  compareDocumentsTool,
];
