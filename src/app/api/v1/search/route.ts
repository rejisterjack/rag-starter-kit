/**
 * @openapi
 * /api/v1/search:
 *   post:
 *     summary: Semantic search
 *     description: Search documents using semantic similarity with optional filters
 *     tags: [Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search query
 *               limit:
 *                 type: integer
 *                 default: 10
 *                 maximum: 100
 *               threshold:
 *                 type: number
 *                 default: 0.7
 *                 minimum: 0
 *                 maximum: 1
 *               filters:
 *                 type: object
 *                 properties:
 *                   documentIds:
 *                     type: array
 *                     items:
 *                       type: string
 *                   metadata:
 *                     type: object
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       text: { type: string }
 *                       documentId: { type: string }
 *                       documentName: { type: string }
 *                       score: { type: number }
 *                       metadata: { type: object }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getServerSession } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { generateQueryEmbedding, searchSimilarChunks } from '@/lib/rag/retrieval';
import type { RAGConfig } from '@/types';

interface SearchRequest {
  query: string;
  limit?: number;
  threshold?: number;
  filters?: {
    documentIds?: string[];
    metadata?: Record<string, unknown>;
  };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const workspace = await getServerSession();
  if (!workspace) {
    return NextResponse.json(
      { error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } },
      { status: 404 }
    );
  }

  const body: SearchRequest = await request.json();

  if (!body.query?.trim()) {
    return NextResponse.json(
      { error: { code: 'INVALID_REQUEST', message: 'Query is required' } },
      { status: 400 }
    );
  }

  try {
    // Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(body.query);

    const config: Partial<RAGConfig> = {
      topK: Math.min(body.limit || 10, 100),
      similarityThreshold: body.threshold ?? 0.7,
      filter: body.filters?.documentIds ? { documentIds: body.filters.documentIds } : undefined,
    };

    const results = await searchSimilarChunks(queryEmbedding, session.user.id, config);

    return NextResponse.json({
      data: results.map((r) => ({
        id: r.id,
        content: r.content,
        documentId: r.documentId,
        documentName: r.documentName,
        score: r.similarity,
        page: r.page,
        section: r.section,
      })),
      meta: {
        query: body.query,
        total: results.length,
        threshold: config.similarityThreshold,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to perform search', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: { code: 'SEARCH_ERROR', message: 'Failed to perform search' } },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest) {
  // Redirect GET to POST with proper error
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for search' } },
    { status: 405 }
  );
}
