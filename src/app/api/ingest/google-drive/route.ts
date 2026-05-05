/**
 * POST /api/ingest/google-drive
 *
 * Ingest documents from Google Drive into the knowledge base.
 *
 * Body (one of):
 *   { fileId: string }                    — single file by Drive file ID
 *   { folderId: string, recursive?: boolean, mimeTypes?: string[] }  — whole folder
 *
 * The caller must pass a valid Google OAuth2 access token in the
 * Authorization header:  Authorization: Bearer <google_access_token>
 *
 * The token must have the scope: https://www.googleapis.com/auth/drive.readonly
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateEmbedding } from '@/lib/ai';
import { auth } from '@/lib/auth';
import { getServerSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { GoogleDriveParser } from '@/lib/rag/ingestion/parsers/google-drive';

const bodySchema = z
  .object({
    fileId: z.string().optional(),
    folderId: z.string().optional(),
    recursive: z.boolean().default(false),
    mimeTypes: z.array(z.string()).optional(),
    maxFiles: z.number().int().min(1).max(200).optional(),
  })
  .refine((d) => d.fileId || d.folderId, {
    message: 'Either fileId or folderId is required',
  });

/** Simple fixed-size chunker */
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

async function ingestFile(
  file: {
    id: string;
    name: string;
    mimeType: string;
    content: string;
    webViewLink?: string;
    modifiedTime?: string;
  },
  workspaceId: string,
  userId: string
): Promise<{ documentId: string; name: string; chunks: number }> {
  const contentBytes = Buffer.byteLength(file.content, 'utf-8');

  const document = await prisma.document.create({
    data: {
      name: file.name,
      contentType: file.mimeType,
      size: contentBytes,
      content: file.content,
      sourceUrl: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}`,
      sourceType: 'google_drive',
      workspaceId,
      userId,
      metadata: {
        source: 'google_drive',
        driveFileId: file.id,
        modifiedTime: file.modifiedTime ?? null,
      },
      status: 'PROCESSING',
    },
  });

  const chunks = simpleChunk(file.content, 1000, 200);

  for (let i = 0; i < chunks.length; i++) {
    const { content, start, end } = chunks[i];
    const embedding = await generateEmbedding(content);
    await prisma.$executeRaw`
      INSERT INTO document_chunks ("id", "documentId", "content", "index", "start", "end", "embedding", "createdAt")
      VALUES (
        gen_random_uuid()::text,
        ${document.id},
        ${content},
        ${i},
        ${start},
        ${end},
        ${`[${embedding.join(',')}]`}::vector,
        NOW()
      )
    `;
  }

  await prisma.document.update({
    where: { id: document.id },
    data: { status: 'COMPLETED' },
  });

  return { documentId: document.id, name: file.name, chunks: chunks.length };
}

export async function POST(req: Request) {
  try {
    // App session
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Google OAuth token from Authorization header
    const authHeader = req.headers.get('Authorization') ?? '';
    const googleToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!googleToken) {
      return NextResponse.json(
        {
          error:
            'Google OAuth access token required. Pass it as: Authorization: Bearer <google_access_token>',
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { fileId, folderId, recursive, mimeTypes, maxFiles } = parsed.data;

    const workspace = await getServerSession();
    if (!workspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    const parser = new GoogleDriveParser(googleToken);

    const results: Array<{ documentId: string; name: string; chunks: number }> = [];

    if (fileId) {
      // Single file
      const file = await parser.parseFile(fileId);
      const result = await ingestFile(file, workspace.id, session.user.id);
      results.push(result);
    } else if (folderId) {
      // Folder
      const files = await parser.parseFolder(folderId, { recursive, mimeTypes, maxFiles });
      for (const file of files) {
        const result = await ingestFile(file, workspace.id, session.user.id);
        results.push(result);
      }
    }

    return NextResponse.json({
      success: true,
      documentsCreated: results.length,
      documents: results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Google Drive ingestion failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
