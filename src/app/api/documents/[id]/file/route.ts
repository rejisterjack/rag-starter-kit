/**
 * Document File Streaming API Route
 *
 * GET /api/documents/[id]/file - Stream the document file securely from storage
 */

import { type NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/auth';
import { prismaRead } from '@/lib/db';
import { getFile } from '@/lib/storage';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const MIME_TYPES: Record<string, string> = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  TXT: 'text/plain',
  MD: 'text/markdown',
  HTML: 'text/html',
  AUDIO: 'audio/mpeg',
  VIDEO: 'video/mp4',
};

export const GET = withApiAuth(
  async (_req: NextRequest, session, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const userId = session.user.id;
      const { id: documentId } = await params;

      // 1. Fetch document record
      const document = await prismaRead.document.findUnique({
        where: { id: documentId },
      });

      if (!document) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } },
          { status: 404 }
        );
      }

      // 2. Check access permissions
      const hasDirectAccess = document.userId === userId;
      const hasWorkspaceAccess =
        document.workspaceId &&
        (await checkPermission(userId, document.workspaceId, Permission.READ_DOCUMENTS));

      if (!hasDirectAccess && !hasWorkspaceAccess) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
          { status: 403 }
        );
      }

      // 3. Ensure document has a storage key
      const storageKey = document.storageKey;
      if (!storageKey) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'NO_FILE', message: 'No file associated with this document' },
          },
          { status: 400 }
        );
      }

      // 4. Validate MIME type before downloading
      const contentType = MIME_TYPES[document.contentType] || 'application/octet-stream';
      if (!ALLOWED_MIME_TYPES.has(contentType)) {
        return NextResponse.json(
          { success: false, error: { code: 'UNSUPPORTED_TYPE', message: 'Unsupported file type' } },
          { status: 415 }
        );
      }

      // 5. Download file from storage backend
      const buffer = await getFile(storageKey);

      // 6. Enforce file size limit
      if (buffer.byteLength > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'PAYLOAD_TOO_LARGE', message: 'File exceeds maximum allowed size' },
          },
          { status: 413 }
        );
      }

      // 7. Stream back response with correct headers

      const response = new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${encodeURIComponent(document.name)}"`,
          'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
        },
      });

      return response;
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Internal server error',
          },
        },
        { status: 500 }
      );
    }
  }
);
