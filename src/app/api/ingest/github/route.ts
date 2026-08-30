/**
 * POST /api/ingest/github
 *
 * Ingest Markdown / text files from a GitHub repository.
 *
 * Body:
 *   {
 *     repo: string,          // "owner/repo"
 *     branch?: string,       // defaults to repo's default branch
 *     directory?: string,    // sub-path to restrict to, e.g. "docs"
 *     extensions?: string[], // defaults to [".md", ".mdx", ".txt"]
 *     maxFiles?: number      // safety limit, defaults to 200
 *   }
 *
 * Requires GITHUB_TOKEN env var for private repos and higher rate limits.
 */

import { z } from 'zod';
import { generateEmbedding } from '@/lib/ai';
import { apiError, apiSuccess } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { getServerSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { GitHubParser } from '@/lib/rag/ingestion/parsers/github';

const bodySchema = z.object({
  repo: z.string().regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, 'Must be in "owner/repo" format'),
  branch: z.string().optional(),
  directory: z.string().optional(),
  extensions: z.array(z.string()).optional(),
  maxFiles: z.number().int().min(1).max(500).optional(),
});

/** Very simple text chunker */
function simpleChunk(
  text: string,
  maxChars = 1000,
  overlap = 200
): Array<{ content: string; start: number; end: number }> {
  const chunks: Array<{ content: string; start: number; end: number }> = [];
  let offset = 0;

  while (offset < text.length) {
    const end = Math.min(offset + maxChars, text.length);
    chunks.push({ content: text.slice(offset, end), start: offset, end });
    offset += maxChars - overlap;
    if (offset >= text.length) break;
  }

  return chunks;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid input', 400, parsed.error.flatten());
    }

    const { repo, branch, directory, extensions, maxFiles } = parsed.data;

    // Resolve workspace
    const workspace = await getServerSession();
    if (!workspace) {
      return apiError('NOT_FOUND', 'No workspace found', 404);
    }

    const githubToken = process.env.GITHUB_TOKEN;
    const parser = new GitHubParser(githubToken);

    const files = await parser.parseRepo(repo, { branch, directory, extensions, maxFiles });

    if (files.length === 0) {
      return apiSuccess({
        message: 'No matching files found in repository',
        documentsCreated: 0,
      });
    }

    const results: Array<{ path: string; documentId: string; chunks: number }> = [];

    for (const file of files) {
      const contentBytes = Buffer.byteLength(file.content, 'utf-8');

      const document = await prisma.document.create({
        data: {
          name: file.title || file.path,
          contentType: 'text/markdown',
          size: contentBytes,
          content: file.content,
          sourceUrl: file.url,
          sourceType: 'github',
          workspaceId: workspace.id,
          userId: session.user.id,
          metadata: {
            source: 'github',
            repo,
            path: file.path,
            sha: file.sha,
            branch: branch ?? 'default',
          },
          status: 'PROCESSING',
        },
      });

      const chunks = simpleChunk(file.content, 1000, 200);

      const { upsertChunks } = await import('@/lib/vector');
      const chunkPoints = await Promise.all(
        chunks.map(async ({ content, start, end }, i) => {
          const embedding = await generateEmbedding(content);
          return {
            documentId: document.id,
            content,
            embedding,
            index: i,
            start,
            end,
          };
        })
      );
      await upsertChunks(chunkPoints, {
        userId: session.user.id,
        workspaceId: workspace.id,
        documentName: file.title || file.path,
        documentType: 'github',
      });

      await prisma.document.update({
        where: { id: document.id },
        data: { status: 'COMPLETED' },
      });

      results.push({ path: file.path, documentId: document.id, chunks: chunks.length });
    }

    return apiSuccess({
      repo,
      documentsCreated: results.length,
      documents: results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'GitHub ingestion failed';
    return apiError('INTERNAL_ERROR', message, 500);
  }
}
