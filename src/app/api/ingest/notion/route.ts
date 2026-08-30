/**
 * POST /api/ingest/notion
 *
 * Ingest a Notion page into the knowledge base.
 *
 * Body:
 *   { url: string }
 *
 * Requires NOTION_API_KEY in environment variables.
 */

import { z } from 'zod';
import { generateEmbedding } from '@/lib/ai';
import { apiError, apiSuccess } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { getServerSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { NotionParser } from '@/lib/rag/ingestion/parsers/notion';

const bodySchema = z.object({
  url: z.string().min(1, 'URL is required'),
});

/** Very simple text chunker — splits on paragraphs then by char limit */
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

    const { url } = parsed.data;

    // Resolve workspace
    const workspace = await getServerSession();
    if (!workspace) {
      return apiError('NOT_FOUND', 'No workspace found', 404);
    }

    // Get Notion API key
    const notionApiKey = process.env.NOTION_API_KEY;
    if (!notionApiKey) {
      return apiError('NOT_CONFIGURED', 'NOTION_API_KEY is not configured on this server', 503);
    }

    const parser = new NotionParser(notionApiKey);
    const result = await parser.parse(url);

    const contentBytes = Buffer.byteLength(result.content, 'utf-8');

    // Create document record
    const document = await prisma.document.create({
      data: {
        name: result.title,
        contentType: 'text/markdown',
        size: contentBytes,
        content: result.content,
        sourceUrl: result.url,
        sourceType: 'notion',
        workspaceId: workspace.id,
        userId: session.user.id,
        metadata: {
          source: 'notion',
          pageId: result.pageId,
          lastEditedAt: result.lastEditedAt ?? null,
        },
        status: 'PROCESSING',
      },
    });

    // Chunk and embed
    const chunks = simpleChunk(result.content, 1000, 200);

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
      documentName: result.title,
      documentType: 'notion',
    });

    await prisma.document.update({
      where: { id: document.id },
      data: { status: 'COMPLETED' },
    });

    return apiSuccess({
      documentId: document.id,
      title: result.title,
      chunks: chunks.length,
      pageId: result.pageId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Notion ingestion failed';
    return apiError('INTERNAL_ERROR', message, 500);
  }
}
