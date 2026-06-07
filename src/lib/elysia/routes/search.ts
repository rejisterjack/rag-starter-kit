import { Elysia, t } from 'elysia';
import { generateQueryEmbedding, searchSimilarChunks } from '@/lib/rag/retrieval';
import type { RAGConfig } from '@/types';
import { requireAuth } from '../plugins/auth';

export const searchRoutes = new Elysia({
  name: 'elysia/search',
  prefix: '/search',
})
  .use(requireAuth)
  .post(
    '/',
    async ({ session, workspace, body, set }) => {
      if (!workspace) {
        set.status = 404;
        return { error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } };
      }

      try {
        const queryEmbedding = await generateQueryEmbedding(body.query);

        const config: Partial<RAGConfig> = {
          topK: Math.min(body.limit ?? 10, 100),
          similarityThreshold: body.threshold ?? 0.7,
          filter: body.filters?.documentIds ? { documentIds: body.filters.documentIds } : undefined,
        };

        const results = await searchSimilarChunks(queryEmbedding, session?.userId, config);

        return {
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
        };
      } catch {
        set.status = 500;
        return { error: { code: 'SEARCH_ERROR', message: 'Failed to perform search' } };
      }
    },
    {
      body: t.Object({
        query: t.String({ minLength: 1 }),
        limit: t.Optional(t.Number({ default: 10, maximum: 100 })),
        threshold: t.Optional(t.Number({ default: 0.7, minimum: 0, maximum: 1 })),
        filters: t.Optional(
          t.Object({
            documentIds: t.Optional(t.Array(t.String())),
            metadata: t.Optional(t.Record(t.String(), t.Unknown())),
          })
        ),
      }),
    }
  );
