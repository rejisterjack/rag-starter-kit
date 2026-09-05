import { publicChatRequestSchema } from '@rag-starter-kit/api-schemas';
import { type NextRequest, NextResponse } from 'next/server';
import { wrapStreamWithErrorFrame } from '@/lib/api/stream-error-wrapper';
import { apiError, apiSuccess } from '@/lib/api-response';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { logger } from '@/lib/logger';
import { streamRAGResponse } from '@/lib/rag/engine';
import { validateApiKey } from '@/lib/security/api-keys';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

export const maxDuration = 120;

function mapSourcesToCitations(
  sources: Array<{
    content: string;
    similarity?: number;
    metadata?: Record<string, unknown> | undefined;
  }>
) {
  return sources.map((source, index) => ({
    id: index + 1,
    documentId: source.metadata?.documentId,
    documentName: source.metadata?.documentName || 'Unknown Document',
    page: source.metadata?.page,
    score: source.similarity,
    content: source.content.slice(0, 200) + (source.content.length > 200 ? '...' : ''),
  }));
}

export async function POST(req: Request) {
  const startTime = Date.now();
  let streamError: string | null = null;

  try {
    const authHeader = req.headers.get('authorization');
    const apiKey = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.headers.get('x-api-key');

    if (!apiKey) {
      return apiError('UNAUTHORIZED', 'API key required', 401);
    }

    const keyValidation = await validateApiKey(apiKey, {
      requiredPermissions: [Permission.READ_CHATS, Permission.WRITE_CHATS],
    });

    if (!keyValidation.valid) {
      await logAuditEvent({
        event: AuditEvent.SUSPICIOUS_ACTIVITY,
        metadata: { activity: 'public_chat_invalid_api_key', error: keyValidation.error },
        severity: 'WARNING',
      });
      return apiError('UNAUTHORIZED', 'Invalid API key', 401);
    }

    const workspaceId = keyValidation.workspaceId;
    if (!workspaceId) {
      return apiError('WORKSPACE_REQUIRED', 'API key not associated with a workspace', 403);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Failed to parse request body for public chat', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return apiError('INVALID_JSON', 'Invalid JSON in request body', 400);
    }

    const parseResult = publicChatRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return apiError(
        'VALIDATION_ERROR',
        'Invalid request',
        400,
        parseResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }))
      );
    }

    const { question, history, config, workspaceId: requestedWorkspaceId } = parseResult.data;

    if (requestedWorkspaceId && requestedWorkspaceId !== workspaceId) {
      await logAuditEvent({
        event: AuditEvent.PERMISSION_DENIED,
        workspaceId,
        metadata: {
          action: 'public_chat_workspace_mismatch',
          requestedWorkspaceId,
        },
        severity: 'WARNING',
      });
      return apiError('FORBIDDEN', 'API key cannot access the requested workspace', 403);
    }

    const hasPermission = await checkPermission(
      keyValidation.keyId || '',
      workspaceId,
      Permission.READ_DOCUMENTS
    );

    if (!hasPermission) {
      await logAuditEvent({
        event: AuditEvent.PERMISSION_DENIED,
        workspaceId,
        metadata: { action: 'public_chat', requiredPermission: Permission.READ_DOCUMENTS },
        severity: 'WARNING',
      });
      return apiError('FORBIDDEN', 'Insufficient permissions to access workspace documents', 403);
    }

    const ragConfig = {
      ...config,
      model: config?.model || 'auto',
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 2000,
      topK: config?.topK ?? 5,
      similarityThreshold: config?.similarityThreshold ?? 0.7,
    };

    const encoder = new TextEncoder();
    const rawResponse = new Response(
      new ReadableStream({
        async start(controller) {
          try {
            for await (const event of streamRAGResponse({
              query: question,
              userId: workspaceId,
              workspaceId,
              history,
              config: ragConfig,
            })) {
              if (event.type === 'sources' && event.sources) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'sources',
                      citations: mapSourcesToCitations(
                        event.sources.map((s) => ({
                          content: s.content,
                          similarity: s.similarity,
                          metadata: s.metadata as unknown as Record<string, unknown> | undefined,
                        }))
                      ),
                    })}\n\n`
                  )
                );
              } else if (event.type === 'content' && event.content) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'content', content: event.content })}\n\n`
                  )
                );
              } else if (event.type === 'done') {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'done',
                      metadata: {
                        latency: Date.now() - startTime,
                        workspaceId,
                      },
                    })}\n\n`
                  )
                );
              } else if (event.type === 'error') {
                streamError = event.error || 'Stream error';
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'error', message: streamError })}\n\n`
                  )
                );
              }
            }

            await logAuditEvent({
              event: AuditEvent.CHAT_CREATED,
              userId: keyValidation.keyId,
              workspaceId,
              metadata: {
                question: question.slice(0, 100),
                latency: Date.now() - startTime,
                streaming: true,
              },
            });
          } catch (error) {
            streamError = error instanceof Error ? error.message : 'Unknown error';
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', message: streamError })}\n\n`)
            );
          } finally {
            controller.close();
          }
        },
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      }
    );

    return wrapStreamWithErrorFrame(rawResponse, () => streamError);
  } catch (error) {
    await logAuditEvent({
      event: AuditEvent.CHAT_MESSAGE_SENT,
      metadata: {
        endpoint: '/api/public/chat',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      severity: 'WARNING',
    });

    return apiError(
      'INTERNAL_ERROR',
      'Failed to generate response',
      500,
      process.env.NODE_ENV === 'production'
        ? 'An internal error occurred'
        : error instanceof Error
          ? error.message
          : 'Unknown error'
    );
  }
}

export async function GET() {
  return apiSuccess({
    name: 'RAG Starter Kit Public API',
    version: '1.0.0',
    endpoints: {
      'POST /api/public/chat': {
        description: 'Chat with your documents using RAG (Server-Sent Events)',
        authentication: 'API Key required (Bearer token or X-API-Key header)',
        contentType: 'text/event-stream',
        requestBody: {
          question: 'string (required) - Your question',
          history: 'array (optional) - Previous messages',
          config: 'object (optional) - Model configuration',
        },
        streamEvents: {
          sources: '{ type: "sources", citations: [...] }',
          content: '{ type: "content", content: "token" }',
          done: '{ type: "done", metadata: {...} }',
          error: '{ type: "error", message: "..." }',
        },
      },
      'POST /api/public/ingest': {
        description: 'Ingest a URL into the workspace knowledge base',
        authentication: 'API Key with WRITE_DOCUMENTS permission',
        requestBody: { url: 'string (required)', metadata: 'object (optional)' },
      },
    },
    documentation: 'https://docs.ragstarterkit.com/api',
  });
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? process.env.NEXTAUTH_URL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigin = allowedOrigins.includes(origin) ? origin : '';

  return new NextResponse(null, {
    status: 204,
    headers: {
      ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  });
}
