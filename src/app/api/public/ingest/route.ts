/**
 * POST /api/public/ingest — URL ingestion for API key clients (Chrome extension, widgets).
 */

import { publicIngestRequestSchema } from '@rag-starter-kit/api-schemas';
import { apiError, apiSuccess } from '@/lib/api-response';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { processDocumentInline } from '@/lib/rag/ingestion/inline-processor';
import { isYouTubeUrl } from '@/lib/rag/ingestion/parsers/youtube';
import { validateApiKey } from '@/lib/security/api-keys';
import { validateUrlSafety } from '@/lib/security/ssrf-protection';
import { Permission } from '@/lib/workspace/permissions';

export const maxDuration = 60;

function dispatchOrProcessDirect(documentId: string, userId: string) {
  void processDocumentInline(documentId, userId).catch(async (err) => {
    const errMsg = err instanceof Error ? err.message : 'Unknown';
    logger.error('Public ingest processing failed', { documentId, error: errMsg });
    await prisma.document
      .update({
        where: { id: documentId },
        data: { status: 'FAILED', metadata: { error: errMsg, failedAt: new Date().toISOString() } },
      })
      .catch(() => undefined);
  });
}

export async function POST(req: Request) {
  const startTime = Date.now();

  const authHeader = req.headers.get('authorization');
  const apiKey = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.headers.get('x-api-key');

  if (!apiKey) {
    return apiError('UNAUTHORIZED', 'API key required', 401);
  }

  const keyValidation = await validateApiKey(apiKey, {
    requiredPermissions: [Permission.WRITE_DOCUMENTS],
  });

  if (!keyValidation.valid || !keyValidation.workspaceId) {
    return apiError('UNAUTHORIZED', 'Invalid API key', 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('BAD_REQUEST', 'Invalid JSON', 400);
  }

  const parsed = publicIngestRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid request', 400, parsed.error.flatten());
  }

  const { url, metadata = {} } = parsed.data;
  const workspaceId = keyValidation.workspaceId;
  const userId = keyValidation.keyId || workspaceId;

  const ssrfCheck = await validateUrlSafety(url);
  if (!ssrfCheck.safe) {
    return apiError('FORBIDDEN', ssrfCheck.reason || 'URL is not allowed', 403);
  }

  const validatedUrl = new URL(url);
  const isYT = isYouTubeUrl(url);
  const docContentType = isYT ? 'VIDEO' : 'HTML';
  const docName =
    (typeof metadata.title === 'string' && metadata.title) ||
    (isYT ? `YouTube: ${url}` : validatedUrl.hostname + validatedUrl.pathname);

  const document = await prisma.document.create({
    data: {
      name: docName,
      contentType: docContentType,
      size: 0,
      status: 'PENDING',
      userId,
      workspaceId,
      metadata: {
        sourceUrl: url,
        domain: validatedUrl.hostname,
        isYouTube: isYT,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
        source: 'public-api',
        ...metadata,
      },
    },
  });

  dispatchOrProcessDirect(document.id, userId);

  await logAuditEvent({
    event: AuditEvent.DOCUMENT_UPLOADED,
    userId,
    workspaceId,
    metadata: { documentId: document.id, sourceUrl: url, type: isYT ? 'YOUTUBE' : 'URL' },
  });

  return apiSuccess(
    {
      document: {
        id: document.id,
        name: document.name,
        url,
        status: 'pending',
        createdAt: document.createdAt.toISOString(),
      },
      processingTimeMs: Date.now() - startTime,
    },
    201
  );
}
