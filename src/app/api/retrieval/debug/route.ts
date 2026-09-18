import { apiError } from '@/lib/api-response';
/**
 * GET /api/retrieval/debug?q=<query>&workspaceId=<id>&limit=<n>
 *
 * Developer endpoint — returns the raw retrieval pipeline output for a query:
 *   - Query embedding (first 8 values)
 *   - Top-k chunks with similarity scores
 *   - Reranking scores (if enabled)
 *   - Timing breakdown
 *
 * Only available when RETRIEVAL_DEBUG=true is set in environment.
 * Always requires authentication.
 *
 * Example:
 *   curl -H "Cookie: ..." \
 *     "http://localhost:7392/api/retrieval/debug?q=what+is+RAG&limit=5"
 */

import { NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/ai';
import { auth } from '@/lib/auth';
import { getServerSession } from '@/lib/auth/session';
export async function GET(req: Request) {
  // Gate on RETRIEVAL_DEBUG env var
  if (process.env.RETRIEVAL_DEBUG !== 'true') {
    return apiError(
      'FORBIDDEN',
      'Retrieval debug mode is disabled. Set RETRIEVAL_DEBUG=true to enable.',
      403
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401);
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim();
  const limitParam = Math.min(parseInt(searchParams.get('limit') ?? '10', 10) || 10, 50);

  if (!query) {
    return apiError('BAD_REQUEST', 'q parameter is required', 400);
  }

  const workspace = await getServerSession();
  if (!workspace) {
    return apiError('NOT_FOUND', 'No workspace found', 404);
  }

  const timings: Record<string, number> = {};
  const t0 = Date.now();

  // Step 1: Generate embedding
  const embedStart = Date.now();
  const embedding = await generateEmbedding(query);
  timings.embedding_ms = Date.now() - embedStart;

  // Step 2: Vector similarity search via Qdrant
  const searchStart = Date.now();
  type ChunkRow = {
    id: string;
    content: string;
    documentId: string;
    index: number;
    similarity: number;
    documentName: string;
  };

  const { searchSimilar } = await import('@/lib/vector');
  const { buildQdrantFilter } = await import('@/lib/vector/filters');
  const qdrantFilter = buildQdrantFilter({ workspaceId: workspace.id });
  const qdrantResults = await searchSimilar(embedding, { filter: qdrantFilter, topK: limitParam });
  const chunks: ChunkRow[] = qdrantResults.map((point) => {
    const p = point.payload ?? {};
    return {
      id: String(point.id),
      content: String(p.content ?? ''),
      documentId: String(p.documentId ?? ''),
      index: Number(p.index ?? 0),
      similarity: point.score ?? 0,
      documentName: String(p.documentName ?? ''),
    };
  });
  timings.vector_search_ms = Date.now() - searchStart;

  // Step 3: Keyword BM25-style scoring (simple term overlap, no external dep)
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const scoredChunks = chunks.map((chunk) => {
    const lower = chunk.content.toLowerCase();
    const keywordMatches = keywords.filter((k) => lower.includes(k)).length;
    const keywordScore = keywords.length > 0 ? keywordMatches / keywords.length : 0;
    const hybridScore = 0.7 * Number(chunk.similarity) + 0.3 * keywordScore;
    return {
      ...chunk,
      similarity: Number(chunk.similarity),
      keywordScore,
      hybridScore,
    };
  });

  timings.total_ms = Date.now() - t0;

  return NextResponse.json(
    {
      query,
      workspaceId: workspace.id,
      embeddingDimensions: embedding.length,
      embeddingPreview: embedding.slice(0, 8),
      timings,
      results: scoredChunks.map((c, i) => ({
        rank: i + 1,
        id: c.id,
        documentId: c.documentId,
        documentName: c.documentName,
        chunkIndex: c.index,
        similarity: Math.round(c.similarity * 10000) / 10000,
        keywordScore: Math.round(c.keywordScore * 10000) / 10000,
        hybridScore: Math.round(c.hybridScore * 10000) / 10000,
        contentPreview: c.content.slice(0, 200) + (c.content.length > 200 ? '…' : ''),
      })),
    },
    {
      headers: {
        'X-Retrieval-Debug': 'true',
        'X-Retrieval-Query': query,
        'X-Retrieval-Total-Ms': String(timings.total_ms),
      },
    }
  );
}
