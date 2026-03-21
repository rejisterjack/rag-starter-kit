/**
 * Chunk Fixtures
 *
 * Sample chunks for testing chunking strategies and RAG retrieval.
 */

import type { DocumentChunk } from '@prisma/client';

// =============================================================================
// Chunk Type Extensions
// =============================================================================

interface ChunkWithMetadata extends Omit<DocumentChunk, 'metadata' | 'embedding'> {
  metadata: Record<string, unknown>;
  embedding?: number[];
}

// =============================================================================
// Financial Document Chunks
// =============================================================================

/**
 * Sample text chunks from a financial document
 */
export const sampleFinancialChunks: Partial<ChunkWithMetadata>[] = [
  {
    id: 'chunk-001',
    documentId: 'doc-001',
    content:
      'Annual Financial Report 2024. This report presents the financial performance of our company for fiscal year 2024. Total revenue reached $150 million, representing a 25% increase from the previous year.',
    metadata: {
      page: 1,
      section: 'Executive Summary',
      tokenCount: 45,
      startChar: 0,
      endChar: 180,
    },
    index: 0,
    createdAt: new Date('2024-01-15T10:05:00Z'),
  },
  {
    id: 'chunk-002',
    documentId: 'doc-001',
    content:
      'Net profit margin improved to 18%, up from 15% in 2023. Revenue Breakdown by Quarter: Q1 2024: $32 million, Q2 2024: $38 million, Q3 2024: $35 million, Q4 2024: $45 million.',
    metadata: {
      page: 2,
      section: 'Revenue Analysis',
      tokenCount: 52,
      startChar: 181,
      endChar: 350,
    },
    index: 1,
    createdAt: new Date('2024-01-15T10:05:00Z'),
  },
  {
    id: 'chunk-003',
    documentId: 'doc-001',
    content:
      'The strongest growth was observed in our enterprise segment, which grew by 40% year-over-year. Our SaaS products contributed $90 million to total revenue, while professional services added $60 million.',
    metadata: {
      page: 3,
      section: 'Segment Performance',
      tokenCount: 48,
      startChar: 351,
      endChar: 500,
    },
    index: 2,
    createdAt: new Date('2024-01-15T10:05:00Z'),
  },
  {
    id: 'chunk-004',
    documentId: 'doc-001',
    content:
      'Total operating expenses were $123 million for the year. Research and development investments increased to $25 million. Sales and marketing expenses totaled $35 million. General and administrative costs remained stable at $18 million.',
    metadata: {
      page: 4,
      section: 'Operating Expenses',
      tokenCount: 55,
      startChar: 501,
      endChar: 680,
    },
    index: 3,
    createdAt: new Date('2024-01-15T10:05:00Z'),
  },
  {
    id: 'chunk-005',
    documentId: 'doc-001',
    content:
      'Future Outlook: We project continued growth in 2025, with revenue targets set at $200 million. Key focus areas include AI-powered features and international expansion into European and Asian markets.',
    metadata: {
      page: 5,
      section: 'Future Outlook',
      tokenCount: 42,
      startChar: 681,
      endChar: 850,
    },
    index: 4,
    createdAt: new Date('2024-01-15T10:05:00Z'),
  },
];

// =============================================================================
// Technical Documentation Chunks
// =============================================================================

/**
 * Sample text chunks from technical documentation
 */
export const sampleTechnicalChunks: Partial<ChunkWithMetadata>[] = [
  {
    id: 'chunk-006',
    documentId: 'doc-002',
    content:
      'API Documentation v2.0. Authentication: All API requests require authentication using Bearer tokens. Include the Authorization header with your API key. Example: Authorization: Bearer sk_live_xxxxxxxxxx',
    metadata: {
      section: 'Authentication',
      tokenCount: 38,
      startChar: 0,
      endChar: 200,
    },
    index: 0,
    createdAt: new Date('2024-01-16T14:10:00Z'),
  },
  {
    id: 'chunk-007',
    documentId: 'doc-002',
    content:
      'Rate Limits: The API implements rate limiting based on your plan. Free tier: 100 requests per hour. Pro tier: 10,000 requests per hour. Enterprise: Unlimited requests.',
    metadata: {
      section: 'Rate Limiting',
      tokenCount: 35,
      startChar: 201,
      endChar: 380,
    },
    index: 1,
    createdAt: new Date('2024-01-16T14:10:00Z'),
  },
  {
    id: 'chunk-008',
    documentId: 'doc-002',
    content:
      'GET /api/v2/documents - List all documents in your workspace. Query parameters: workspaceId (required), limit (optional, default: 20, max: 100), offset (optional).',
    metadata: {
      section: 'Endpoints',
      tokenCount: 32,
      startChar: 381,
      endChar: 520,
    },
    index: 2,
    createdAt: new Date('2024-01-16T14:10:00Z'),
  },
  {
    id: 'chunk-009',
    documentId: 'doc-002',
    content:
      'POST /api/v2/chat - Send a message to the AI assistant. Request body includes message, workspaceId, and optional context with document references.',
    metadata: {
      section: 'Endpoints',
      tokenCount: 28,
      startChar: 521,
      endChar: 650,
    },
    index: 3,
    createdAt: new Date('2024-01-16T14:10:00Z'),
  },
];

// =============================================================================
// Hierarchical Chunks
// =============================================================================

/**
 * Sample chunks with hierarchical structure (parent-child relationships)
 */
export const sampleHierarchicalChunks: Partial<ChunkWithMetadata>[] = [
  {
    id: 'chunk-parent-001',
    documentId: 'doc-003',
    content:
      'Chapter 1: Introduction to Machine Learning. This chapter covers the fundamentals of machine learning, including supervised learning, unsupervised learning, and reinforcement learning paradigms.',
    metadata: {
      level: 1,
      type: 'section',
      tokenCount: 35,
      children: ['chunk-child-001', 'chunk-child-002'],
    },
    index: 0,
    createdAt: new Date('2024-01-17T09:10:00Z'),
  },
  {
    id: 'chunk-child-001',
    documentId: 'doc-003',
    content:
      'Supervised Learning: In supervised learning, the algorithm learns from labeled training data, and makes predictions based on that data. Common algorithms include linear regression, decision trees, and neural networks.',
    metadata: {
      level: 2,
      type: 'subsection',
      parentId: 'chunk-parent-001',
      tokenCount: 38,
    },
    index: 1,
    createdAt: new Date('2024-01-17T09:10:00Z'),
  },
  {
    id: 'chunk-child-002',
    documentId: 'doc-003',
    content:
      'Unsupervised Learning: Unsupervised learning finds patterns in data without labeled outcomes. Techniques include clustering, dimensionality reduction, and association rule learning.',
    metadata: {
      level: 2,
      type: 'subsection',
      parentId: 'chunk-parent-001',
      tokenCount: 32,
    },
    index: 2,
    createdAt: new Date('2024-01-17T09:10:00Z'),
  },
];

// =============================================================================
// Semantic Search Chunks
// =============================================================================

/**
 * Sample chunks for semantic search testing
 */
export const sampleSemanticSearchChunks: Partial<ChunkWithMetadata>[] = [
  {
    id: 'chunk-semantic-001',
    documentId: 'doc-004',
    content:
      'The quick brown fox jumps over the lazy dog. This pangram contains every letter of the English alphabet at least once.',
    metadata: { tokenCount: 22 },
    index: 0,
    createdAt: new Date('2024-01-18T10:00:00Z'),
  },
  {
    id: 'chunk-semantic-002',
    documentId: 'doc-004',
    content:
      'Revenue increased significantly in the fourth quarter, driven by strong sales in the enterprise segment and successful product launches.',
    metadata: { tokenCount: 24, category: 'financial' },
    index: 1,
    createdAt: new Date('2024-01-18T10:00:00Z'),
  },
  {
    id: 'chunk-semantic-003',
    documentId: 'doc-004',
    content:
      'Machine learning algorithms require large amounts of training data to achieve high accuracy on complex tasks like image recognition and natural language processing.',
    metadata: { tokenCount: 26, category: 'technical' },
    index: 2,
    createdAt: new Date('2024-01-18T10:00:00Z'),
  },
  {
    id: 'chunk-semantic-004',
    documentId: 'doc-004',
    content:
      'The company reported earnings of $2.50 per share, beating analyst expectations by $0.15. Full year guidance was raised to reflect continued momentum.',
    metadata: { tokenCount: 25, category: 'financial' },
    index: 3,
    createdAt: new Date('2024-01-18T10:00:00Z'),
  },
];

// =============================================================================
// Embedding Helpers
// =============================================================================

/**
 * Chunks with embeddings for testing vector search
 */
export function createChunksWithEmbeddings(
  dimension: number = 1536
): Array<Partial<ChunkWithMetadata> & { embedding: number[] }> {
  return sampleFinancialChunks.map((chunk, i) => ({
    ...chunk,
    embedding: Array(dimension)
      .fill(0)
      .map(() => Math.sin(i + Math.random())),
  }));
}

// =============================================================================
// Collection
// =============================================================================

/**
 * Collection of all sample chunks
 */
export const allSampleChunks: Partial<ChunkWithMetadata>[] = [
  ...sampleFinancialChunks,
  ...sampleTechnicalChunks,
  ...sampleHierarchicalChunks,
  ...sampleSemanticSearchChunks,
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Helper to create a chunk with specific content
 */
export function createChunk(
  content: string,
  overrides: Partial<ChunkWithMetadata> = {}
): Partial<ChunkWithMetadata> {
  return {
    id: `chunk-${Date.now()}`,
    documentId: 'doc-default',
    content,
    metadata: {},
    index: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create multiple chunks from text
 */
export function createChunksFromText(
  text: string,
  chunkSize: number = 500,
  documentId: string = 'doc-default'
): Partial<ChunkWithMetadata>[] {
  const words = text.split(/\s+/);
  const chunks: Partial<ChunkWithMetadata>[] = [];
  let currentChunk: string[] = [];
  let index = 0;

  for (const word of words) {
    currentChunk.push(word);
    if (currentChunk.join(' ').length >= chunkSize) {
      chunks.push(
        createChunk(currentChunk.join(' '), {
          id: `chunk-${index}`,
          documentId,
          index,
        })
      );
      currentChunk = [];
      index++;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(
      createChunk(currentChunk.join(' '), {
        id: `chunk-${index}`,
        documentId,
        index,
      })
    );
  }

  return chunks;
}
