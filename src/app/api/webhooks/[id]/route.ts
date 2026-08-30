import type { WebhookStatus } from '@/generated/prisma/client';
import { apiError, apiSuccess } from '@/lib/api-response';
import { withApiAuth } from '@/lib/auth';
import { prisma, prismaRead } from '@/lib/db';
import { inngest } from '@/lib/inngest/client';
import { logger } from '@/lib/logger';
import { verifyWebhookSignature } from '@/lib/webhooks/delivery';
import { processWithIdempotency } from '@/lib/webhooks/idempotency';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// ============================================================================
// Types & Validation
// ============================================================================

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface UpdateWebhookInput {
  name?: string;
  url?: string;
  events?: string[];
  status?: WebhookStatus;
}

function validateUpdateWebhookInput(body: unknown): UpdateWebhookInput {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid input: expected an object');
  }

  const input = body as Record<string, unknown>;
  const result: UpdateWebhookInput = {};

  // Validate name (optional)
  if ('name' in input) {
    if (typeof input.name !== 'string' || input.name.length < 1 || input.name.length > 100) {
      throw new Error('Invalid name: must be a string between 1 and 100 characters');
    }
    result.name = input.name;
  }

  // Validate URL (optional)
  if ('url' in input) {
    if (typeof input.url !== 'string') {
      throw new Error('Invalid url: must be a valid URL string');
    }

    // Basic URL validation
    try {
      const url = new URL(input.url);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid url: must use http or https protocol');
      }
    } catch (error: unknown) {
      logger.debug('Invalid URL in webhook update validation', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Invalid url: must be a valid URL');
    }

    result.url = input.url;
  }

  // Validate events (optional)
  if ('events' in input) {
    if (!Array.isArray(input.events) || input.events.length === 0) {
      throw new Error('Invalid events: must be a non-empty array of event strings');
    }

    for (const event of input.events) {
      if (typeof event !== 'string' || event.length === 0) {
        throw new Error('Invalid events: all events must be non-empty strings');
      }
    }

    result.events = input.events;
  }

  // Validate status (optional)
  if ('status' in input) {
    if (!['ACTIVE', 'PAUSED', 'FAILED'].includes(input.status as string)) {
      throw new Error('Invalid status: must be one of ACTIVE, PAUSED, or FAILED');
    }
    result.status = input.status as WebhookStatus;
  }

  return result;
}

// ============================================================================
// GET /api/webhooks/[id]
// ============================================================================

/**
 * GET /api/webhooks/[id]
 * Get a specific webhook
 */
export const GET = withApiAuth(async (_req: Request, session, { params }: RouteParams) => {
  try {
    const { id } = await params;

    // Get the webhook
    const webhook = await prismaRead.webhook.findUnique({
      where: { id },
    });

    if (!webhook) {
      return apiError('NOT_FOUND', 'Webhook not found', 404);
    }

    // Check if user has permission to manage API keys in this workspace
    const hasPermission = await checkPermission(
      session.user.id,
      webhook.workspaceId,
      Permission.MANAGE_API_KEYS
    );

    if (!hasPermission) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    return apiSuccess({
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        status: webhook.status,
        lastTriggeredAt: webhook.lastTriggeredAt?.toISOString() ?? null,
        failureCount: webhook.failureCount,
        createdAt: webhook.createdAt.toISOString(),
        updatedAt: webhook.updatedAt.toISOString(),
        workspaceId: webhook.workspaceId,
        createdById: webhook.createdById,
      },
    });
  } catch (error) {
    logger.error('Failed to get webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return apiError('INTERNAL_ERROR', 'Failed to get webhook', 500);
  }
});

// ============================================================================
// POST /api/webhooks/[id] — Ingest document via webhook
// ============================================================================

/**
 * POST /api/webhooks/[id]
 * Ingest a document through the webhook endpoint.
 *
 * Supports two payload formats:
 * 1. `{ "url": "https://example.com/doc.pdf" }` — fetch and ingest from URL
 * 2. `{ "content": "text content", "title": "Document Title" }` — ingest raw text
 *
 * Security:
 * - Verifies HMAC-SHA256 signature via x-webhook-signature header
 * - Uses idempotency to prevent duplicate processing
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 1. Read the webhook config from the database
    const webhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!webhook) {
      return apiError('NOT_FOUND', 'Webhook not found', 404);
    }

    if (webhook.status !== 'ACTIVE') {
      return apiError('WEBHOOK_PAUSED', 'This webhook is not active', 400);
    }

    // 2. Read raw body and verify signature
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('x-webhook-signature');

    if (!signatureHeader) {
      return apiError('MISSING_SIGNATURE', 'x-webhook-signature header is required', 401);
    }

    const isValid = verifyWebhookSignature(rawBody, signatureHeader, webhook.secret);
    if (!isValid) {
      logger.warn('Webhook signature verification failed', { webhookId: id });
      return apiError('INVALID_SIGNATURE', 'Signature verification failed', 401);
    }

    // 3. Parse the payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch (error: unknown) {
      logger.debug('Invalid JSON in webhook ingestion payload', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return apiError('INVALID_JSON', 'Request body must be valid JSON', 400);
    }

    // Determine ingestion mode
    const isUrlMode = typeof payload.url === 'string' && payload.url.length > 0;
    const isContentMode = typeof payload.content === 'string' && payload.content.length > 0;

    if (!isUrlMode && !isContentMode) {
      return apiError(
        'INVALID_PAYLOAD',
        'Payload must contain either a "url" field or a "content" field',
        400
      );
    }

    // Use an idempotency key from the header, or derive from payload hash
    const eventId =
      req.headers.get('x-webhook-id') ||
      `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    // 4-6. Process with idempotency
    const result = await processWithIdempotency(
      webhook.id,
      'document.ingest',
      eventId,
      async () => {
        // Determine document fields based on mode
        let docName: string;
        let contentType: string;
        let contentValue: string | null;
        let sourceUrl: string | undefined;
        let docSize: number;

        if (isUrlMode) {
          // URL mode — content will be fetched during ingestion
          const url = payload.url as string;
          try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
              throw new Error('Invalid protocol');
            }
          } catch (error: unknown) {
            logger.debug('Invalid URL in webhook payload', {
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new Error('Invalid URL provided in payload');
          }
          docName =
            (typeof payload.title === 'string' ? payload.title : '') ||
            new URL(url).hostname + new URL(url).pathname;
          contentType = 'HTML';
          contentValue = null;
          sourceUrl = url;
          docSize = 0;
        } else {
          // Raw text content mode
          docName = (typeof payload.title === 'string' ? payload.title : '') || 'Webhook Document';
          contentType = 'TXT';
          contentValue = payload.content as string;
          docSize = Buffer.byteLength(contentValue, 'utf-8');
        }

        // 4. Create document record
        const document = await prisma.document.create({
          data: {
            name: docName,
            contentType,
            size: docSize,
            status: 'PENDING',
            userId: webhook.createdById,
            workspaceId: webhook.workspaceId,
            content: contentValue,
            sourceUrl: sourceUrl,
            metadata: {
              source: 'webhook',
              webhookId: webhook.id,
              ...(sourceUrl && { sourceUrl }),
              uploadedAt: new Date().toISOString(),
            },
          },
        });

        // 5. Trigger background ingestion
        await inngest.send({
          name: 'document/ingest',
          data: {
            documentId: document.id,
            userId: webhook.createdById,
          },
        });

        // Update webhook last triggered timestamp
        await prisma.webhook.update({
          where: { id: webhook.id },
          data: { lastTriggeredAt: new Date() },
        });

        logger.info('Document created via webhook', {
          documentId: document.id,
          webhookId: webhook.id,
          mode: isUrlMode ? 'url' : 'content',
        });

        return { success: true, documentId: document.id };
      },
      {
        onDuplicate: (previousResponse) => {
          // Return the cached response for duplicates
          if (previousResponse?.body) {
            try {
              return JSON.parse(previousResponse.body) as { success: boolean; documentId: string };
            } catch (error: unknown) {
              logger.debug('Failed to parse duplicate webhook response', {
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
          return { success: true, documentId: null, deduplicated: true };
        },
      }
    );

    // 7. Return success response
    return apiSuccess(result);
  } catch (error) {
    // Handle idempotency errors gracefully
    if (error instanceof Error && error.message === 'Event already processed') {
      return apiSuccess({ message: 'Event already processed' });
    }

    const isDev = process.env.NODE_ENV === 'development';
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Distinguish validation errors from internal errors
    if (message === 'Invalid URL provided in payload' || message.startsWith('Invalid')) {
      return apiError('VALIDATION_ERROR', isDev ? message : 'Validation failed', 400);
    }

    logger.error('Webhook ingestion failed', {
      error: message,
    });

    return apiError('INTERNAL_ERROR', isDev ? message : 'Webhook ingestion failed', 500);
  }
}

// ============================================================================
// PATCH /api/webhooks/[id]
// ============================================================================

/**
 * PATCH /api/webhooks/[id]
 * Update a webhook
 */
export const PATCH = withApiAuth(async (req: Request, session, { params }: RouteParams) => {
  try {
    const { id } = await params;

    // Get the webhook to check workspace
    const existingWebhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!existingWebhook) {
      return apiError('NOT_FOUND', 'Webhook not found', 404);
    }

    // Check if user has permission to manage API keys in this workspace
    const hasPermission = await checkPermission(
      session.user.id,
      existingWebhook.workspaceId,
      Permission.MANAGE_API_KEYS
    );

    if (!hasPermission) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in webhook update', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return apiError('INVALID_BODY', 'Invalid JSON body', 400);
    }

    let validatedInput: UpdateWebhookInput;
    const isDev = process.env.NODE_ENV === 'development';
    try {
      validatedInput = validateUpdateWebhookInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return apiError('VALIDATION_ERROR', isDev ? error.message : 'Validation failed', 400);
      }
      throw error;
    }

    // Check if URL is being changed and if it conflicts with another webhook
    if (validatedInput.url && validatedInput.url !== existingWebhook.url) {
      const duplicateWebhook = await prisma.webhook.findFirst({
        where: {
          workspaceId: existingWebhook.workspaceId,
          url: validatedInput.url,
          id: { not: id },
        },
      });

      if (duplicateWebhook) {
        return apiError(
          'DUPLICATE_WEBHOOK',
          'A webhook with this URL already exists in the workspace',
          409
        );
      }
    }

    // Update webhook
    const updatedWebhook = await prisma.webhook.update({
      where: { id },
      data: {
        ...(validatedInput.name && { name: validatedInput.name }),
        ...(validatedInput.url && { url: validatedInput.url }),
        ...(validatedInput.events && { events: validatedInput.events }),
        ...(validatedInput.status && { status: validatedInput.status }),
        // Reset failure count when reactivating
        ...(validatedInput.status === 'ACTIVE' && { failureCount: 0 }),
      },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        status: true,
        lastTriggeredAt: true,
        failureCount: true,
        createdAt: true,
        updatedAt: true,
        workspaceId: true,
        createdById: true,
      },
    });

    logger.info('Webhook updated', {
      webhookId: id,
      workspaceId: updatedWebhook.workspaceId,
      userId: session.user.id,
      updates: validatedInput,
    });

    return apiSuccess({
      webhook: {
        ...updatedWebhook,
        createdAt: updatedWebhook.createdAt.toISOString(),
        updatedAt: updatedWebhook.updatedAt.toISOString(),
        lastTriggeredAt: updatedWebhook.lastTriggeredAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    logger.error('Failed to update webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return apiError('INTERNAL_ERROR', 'Failed to update webhook', 500);
  }
});

// ============================================================================
// DELETE /api/webhooks/[id]
// ============================================================================

/**
 * DELETE /api/webhooks/[id]
 * Delete a webhook
 */
export const DELETE = withApiAuth(async (_req: Request, session, { params }: RouteParams) => {
  try {
    const { id } = await params;

    // Get the webhook to check workspace
    const existingWebhook = await prisma.webhook.findUnique({
      where: { id },
    });

    if (!existingWebhook) {
      return apiError('NOT_FOUND', 'Webhook not found', 404);
    }

    // Check if user has permission to manage API keys in this workspace
    const hasPermission = await checkPermission(
      session.user.id,
      existingWebhook.workspaceId,
      Permission.MANAGE_API_KEYS
    );

    if (!hasPermission) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Delete the webhook
    await prisma.webhook.delete({
      where: { id },
    });

    logger.info('Webhook deleted', {
      webhookId: id,
      workspaceId: existingWebhook.workspaceId,
      userId: session.user.id,
    });

    return apiSuccess({
      message: 'Webhook deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete webhook', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return apiError('INTERNAL_ERROR', 'Failed to delete webhook', 500);
  }
});
