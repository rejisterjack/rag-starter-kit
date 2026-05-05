/**
 * /api/chat/debug — Retrieval Debug Mode
 *
 * Accepts a query and returns the raw retrieved chunks with similarity scores,
 * the constructed prompt context, and retrieval metadata — WITHOUT generating
 * an LLM response.
 *
 * Enable in any environment by:
 *  - Request header: X-Retrieval-Debug: true
 *  - Query parameter: ?debug=true
 *  - Environment variable: RETRIEVAL_DEBUG=true (enables for all requests)
 *
 * Use this to:
 *  - Verify documents are being retrieved correctly
 *  - Inspect chunk quality and similarity scores
 *  - Tune SIMILARITY_THRESHOLD and TOP_K_RETRIEVAL values
 *  - Debug incorrect or hallucinated answers
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  buildContext,
  generateQueryEmbedding,
  hybridSearch,
  retrieveSources,
} from '@/lib/rag/retrieval';
import type { RAGConfig, Source, VectorSearchResult } from '@/types';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const debugQuerySchema = z.object({
  query: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(50).optional().default(5),
  similarityThreshold: z.number().min(0).max(1).optional().default(0.7),
  searchMode: z.enum(['vector', 'hybrid', 'keyword']).optional().default('hybrid'),
  workspaceId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isDebugEnabled(req: Request): boolean {
  // 1. Global env var
  if (process.env.RETRIEVAL_DEBUG === 'true') return true;
  // 2. Request header
  if (req.headers.get('x-retrieval-debug') === 'true') return true;
  // 3. Query param
  const url = new URL(req.url);
  if (url.searchParams.get('debug') === 'true') return true;
  return false;
}

// ---------------------------------------------------------------------------
// POST /api/chat/debug
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  // --- Auth ---
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- Debug gate ---
  const debugEnabled = isDebugEnabled(req);
  if (!debugEnabled) {
    return NextResponse.json(
      {
        error: 'Retrieval debug mode is not enabled.',
        instructions: {
          header: 'Add header: X-Retrieval-Debug: true',
          queryParam: 'Append ?debug=true to the request URL',
          envVar: 'Set RETRIEVAL_DEBUG=true in your environment',
        },
      },
      { status: 403 }
    );
  }

  // --- Parse body ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = debugQuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { query, topK, similarityThreshold, searchMode } = parsed.data;
  const userId = session.user.id;

  const ragConfig: Partial<RAGConfig> = {
    topK,
    similarityThreshold,
  };

  const startMs = Date.now();

  try {
    // --- Step 1: Generate query embedding ---
    const embeddingStart = Date.now();
    const queryEmbedding = await generateQueryEmbedding(query);
    const embeddingMs = Date.now() - embeddingStart;

    // --- Step 2: Retrieve chunks ---
    // retrieveSources → Source[], hybridSearch → VectorSearchResult[]
    const retrievalStart = Date.now();
    let vectorResults: VectorSearchResult[] = [];
    let sources: Source[] = [];

    if (searchMode === 'hybrid') {
      vectorResults = await hybridSearch(query, queryEmbedding, userId, ragConfig);
    } else {
      sources = await retrieveSources(query, userId, ragConfig);
    }

    const retrievalMs = Date.now() - retrievalStart;

    // --- Step 3: Build context string (only available from Source[] path) ---
    const context = sources.length > 0 ? buildContext(sources, 8000) : '';
    const totalMs = Date.now() - startMs;

    // Normalise results from both search paths into a uniform shape
    const chunks =
      sources.length > 0
        ? sources.map((s: Source, i: number) => ({
            rank: i + 1,
            documentName: s.metadata?.documentName ?? 'Unknown',
            chunkIndex: s.metadata?.chunkIndex ?? i,
            similarity: typeof s.similarity === 'number' ? Number(s.similarity.toFixed(4)) : null,
            contentLength: s.content?.length ?? 0,
            contentPreview: s.content?.slice(0, 300) ?? '',
            metadata: s.metadata ?? {},
          }))
        : vectorResults.map((v: VectorSearchResult, i: number) => ({
            rank: i + 1,
            documentName: v.documentName ?? 'Unknown',
            chunkIndex: v.index ?? i,
            similarity: typeof v.similarity === 'number' ? Number(v.similarity.toFixed(4)) : null,
            contentLength: v.content?.length ?? 0,
            contentPreview: v.content?.slice(0, 300) ?? '',
            metadata: {
              documentId: v.documentId,
              page: v.page,
              section: v.section,
            },
          }));

    // --- Response ---
    return NextResponse.json({
      debug: true,
      query,
      config: {
        topK,
        similarityThreshold,
        searchMode,
        userId,
      },
      timing: {
        embeddingMs,
        retrievalMs,
        totalMs,
      },
      embedding: {
        dimensions: queryEmbedding.length,
        // Only return first 8 values for inspection — full vector is too large
        preview: queryEmbedding.slice(0, 8).map((v) => Number(v.toFixed(6))),
      },
      retrieval: {
        chunkCount: chunks.length,
        chunks,
      },
      context: {
        totalLength: context.length,
        preview: context.slice(0, 1000),
        full: context,
      },
      note: 'No LLM response was generated. This endpoint is for retrieval inspection only.',
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Retrieval failed',
        message: err instanceof Error ? err.message : String(err),
        totalMs: Date.now() - startMs,
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET — Self-documenting endpoint
// ---------------------------------------------------------------------------

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/chat/debug',
    description:
      'Retrieval Debug Mode — inspect retrieved chunks and similarity scores without generating an LLM response.',
    method: 'POST',
    enableUsing: {
      header: 'X-Retrieval-Debug: true',
      queryParam: '?debug=true',
      envVar: 'RETRIEVAL_DEBUG=true',
    },
    body: {
      query: 'string (required) — The query to retrieve chunks for',
      topK: 'number (optional, default: 5) — Number of chunks to retrieve',
      similarityThreshold:
        'number (optional, default: 0.7) — Minimum cosine similarity score (0-1)',
      searchMode: 'vector | hybrid | keyword (optional, default: hybrid)',
    },
    example: {
      curl: `curl -X POST /api/chat/debug?debug=true \\
  -H "Content-Type: application/json" \\
  -d '{"query": "How do I reset my password?", "topK": 5}'`,
    },
  });
}
