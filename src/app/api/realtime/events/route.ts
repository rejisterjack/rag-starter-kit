/**
 * Server-Sent Events (SSE) API Route
 * Real-time updates for: user_joined, user_left, typing_started, typing_stopped, message_received
 * Broadcasts to all connected clients in a workspace
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { isRedisConfigured } from '@/lib/realtime/presence';
import { getRateLimiter } from '@/lib/security/rate-limiter';

// =============================================================================
// SSE Client Store
// =============================================================================

interface SSEClient {
  id: string;
  userId: string;
  userName: string;
  userImage?: string | null;
  workspaceId?: string;
  conversationId?: string;
  documentId?: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  lastPing: number;
  connectedAt: number;
}

// In-memory store of connected SSE clients
const sseClients = new Map<string, SSEClient>();

// Cleanup interval for stale connections
let cleanupInterval: NodeJS.Timeout | null = null;

// Start cleanup interval immediately to prevent memory leaks
// even before first client connects
startCleanupInterval();

function startCleanupInterval(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    const staleTimeout = 60000; // 60 seconds

    for (const [clientId, client] of sseClients.entries()) {
      if (now - client.lastPing > staleTimeout) {
        try {
          // Close the connection gracefully
          client.controller.close();
        } catch (error: unknown) {
          logger.debug('Failed to close stale SSE connection during cleanup', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Connection may already be closed
        }
        sseClients.delete(clientId);
      }
    }
  }, 30000);
}

function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// =============================================================================
// Event Types
// =============================================================================

enum RealtimeEventType {
  // Connection events
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  PING = 'ping',

  // User presence events
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  PRESENCE_UPDATE = 'presence_update',

  // Typing events
  TYPING_STARTED = 'typing_started',
  TYPING_STOPPED = 'typing_stopped',

  // Message events
  MESSAGE_RECEIVED = 'message_received',
  MESSAGE_EDITED = 'message_edited',
  MESSAGE_DELETED = 'message_deleted',

  // Cursor events
  CURSOR_MOVED = 'cursor_moved',

  // Document events
  DOCUMENT_UPDATED = 'document_updated',

  // Error events
  ERROR = 'error',
}

interface SSEEvent {
  event: RealtimeEventType | string;
  data: Record<string, unknown>;
  id?: string;
  retry?: number;
}

// =============================================================================
// SSE Encoder
// =============================================================================

function encodeSSEEvent(event: SSEEvent): Uint8Array {
  let message = '';

  if (event.id) {
    message += `id: ${event.id}\n`;
  }

  message += `event: ${event.event}\n`;

  if (event.retry) {
    message += `retry: ${event.retry}\n`;
  }

  const dataLines = JSON.stringify(event.data).split('\n');
  for (const line of dataLines) {
    message += `data: ${line}\n`;
  }

  message += '\n';

  return new TextEncoder().encode(message);
}

// =============================================================================
// Broadcast Functions
// =============================================================================

/**
 * Broadcast an event to all clients in a workspace
 */
function broadcastToWorkspace(
  workspaceId: string,
  eventType: RealtimeEventType,
  data: Record<string, unknown>,
  excludeClientId?: string
): void {
  const event: SSEEvent = {
    event: eventType,
    data: {
      ...data,
      timestamp: Date.now(),
    },
  };

  const encoded = encodeSSEEvent(event);

  for (const [clientId, client] of sseClients.entries()) {
    if (excludeClientId && clientId === excludeClientId) continue;
    if (client.workspaceId === workspaceId) {
      try {
        client.controller.enqueue(encoded);
        client.lastPing = Date.now();
      } catch (error: unknown) {
        logger.debug('SSE client disconnected during workspace broadcast', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Client disconnected
        sseClients.delete(clientId);
      }
    }
  }
}

/**
 * Broadcast an event to all clients in a conversation
 */
function broadcastToConversation(
  conversationId: string,
  eventType: RealtimeEventType,
  data: Record<string, unknown>,
  excludeClientId?: string
): void {
  const event: SSEEvent = {
    event: eventType,
    data: {
      ...data,
      timestamp: Date.now(),
    },
  };

  const encoded = encodeSSEEvent(event);

  for (const [clientId, client] of sseClients.entries()) {
    if (excludeClientId && clientId === excludeClientId) continue;
    if (client.conversationId === conversationId) {
      try {
        client.controller.enqueue(encoded);
        client.lastPing = Date.now();
      } catch (error: unknown) {
        logger.debug('SSE client disconnected during conversation broadcast', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Client disconnected
        sseClients.delete(clientId);
      }
    }
  }
}

/**
 * Broadcast an event to all clients viewing a document
 */
function broadcastToDocument(
  documentId: string,
  eventType: RealtimeEventType,
  data: Record<string, unknown>,
  excludeClientId?: string
): void {
  const event: SSEEvent = {
    event: eventType,
    data: {
      ...data,
      timestamp: Date.now(),
    },
  };

  const encoded = encodeSSEEvent(event);

  for (const [clientId, client] of sseClients.entries()) {
    if (excludeClientId && clientId === excludeClientId) continue;
    if (client.documentId === documentId) {
      try {
        client.controller.enqueue(encoded);
        client.lastPing = Date.now();
      } catch (error: unknown) {
        logger.debug('SSE client disconnected during document broadcast', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Client disconnected
        sseClients.delete(clientId);
      }
    }
  }
}

/**
 * Send event to a specific user
 */
function sendToUser(
  userId: string,
  eventType: RealtimeEventType,
  data: Record<string, unknown>
): void {
  const event: SSEEvent = {
    event: eventType,
    data: {
      ...data,
      timestamp: Date.now(),
    },
  };

  const encoded = encodeSSEEvent(event);

  for (const [clientId, client] of sseClients.entries()) {
    if (client.userId === userId) {
      try {
        client.controller.enqueue(encoded);
        client.lastPing = Date.now();
      } catch (error: unknown) {
        logger.debug('SSE client disconnected during user send', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Client disconnected
        sseClients.delete(clientId);
      }
    }
  }
}

// =============================================================================
// GET Handler - SSE Connection
// =============================================================================

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    // Check rate limit
    const rateLimiter = getRateLimiter();
    const rateLimitResult = await rateLimiter.checkLimit(`sse:${session.user.id}`, {
      limit: 5,
      windowMs: 60 * 1000, // 1 minute
      prefix: 'sse_connections',
    });

    if (!rateLimitResult.success) {
      await logAuditEvent({
        event: AuditEvent.RATE_LIMIT_HIT,
        userId: session.user.id,
        metadata: {
          type: 'sse_connection',
          endpoint: '/api/realtime/events',
        },
        severity: 'WARNING',
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many SSE connections',
            retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || undefined;
    const conversationId = searchParams.get('conversationId') || undefined;
    const documentId = searchParams.get('documentId') || undefined;

    // Create client ID
    const clientId = `sse_${session.user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create readable stream for SSE
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Send initial connection event
        const connectEvent: SSEEvent = {
          event: RealtimeEventType.CONNECTED,
          data: {
            clientId,
            user: {
              id: session.user.id,
              name: session.user.name || 'Anonymous',
              email: session.user.email || '',
              image: session.user.image,
            },
            timestamp: Date.now(),
            redisEnabled: isRedisConfigured(),
          },
        };
        controller.enqueue(encodeSSEEvent(connectEvent));

        // Store client
        const client: SSEClient = {
          id: clientId,
          userId: session.user.id,
          userName: session.user.name || 'Anonymous',
          userImage: session.user.image,
          workspaceId,
          conversationId,
          documentId,
          controller,
          lastPing: Date.now(),
          connectedAt: Date.now(),
        };
        sseClients.set(clientId, client);

        // Start cleanup interval if not running
        startCleanupInterval();

        // Broadcast user_joined to others in the same room
        if (workspaceId) {
          broadcastToWorkspace(
            workspaceId,
            RealtimeEventType.USER_JOINED,
            {
              user: {
                id: session.user.id,
                name: session.user.name || 'Anonymous',
                image: session.user.image,
              },
              workspaceId,
              conversationId,
              documentId,
            },
            clientId
          );
        }

        if (conversationId) {
          broadcastToConversation(
            conversationId,
            RealtimeEventType.USER_JOINED,
            {
              user: {
                id: session.user.id,
                name: session.user.name || 'Anonymous',
                image: session.user.image,
              },
              conversationId,
            },
            clientId
          );
        }

        // Send ping every 30 seconds to keep connection alive
        const pingInterval = setInterval(() => {
          try {
            const pingEvent: SSEEvent = {
              event: RealtimeEventType.PING,
              data: { timestamp: Date.now() },
            };
            controller.enqueue(encodeSSEEvent(pingEvent));
            client.lastPing = Date.now();
          } catch (error: unknown) {
            logger.debug('SSE ping failed, client disconnected', {
              clientId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Client disconnected
            clearInterval(pingInterval);
            sseClients.delete(clientId);

            // Broadcast user_left
            if (workspaceId) {
              broadcastToWorkspace(workspaceId, RealtimeEventType.USER_LEFT, {
                userId: session.user.id,
                workspaceId,
              });
            }
            if (conversationId) {
              broadcastToConversation(conversationId, RealtimeEventType.USER_LEFT, {
                userId: session.user.id,
                conversationId,
              });
            }

            // Stop cleanup if no more clients
            if (sseClients.size === 0) {
              stopCleanupInterval();
            }
          }
        }, 30000);

        // Handle client disconnect
        req.signal.addEventListener('abort', () => {
          clearInterval(pingInterval);
          sseClients.delete(clientId);

          // Broadcast user_left to others
          if (workspaceId) {
            broadcastToWorkspace(workspaceId, RealtimeEventType.USER_LEFT, {
              userId: session.user.id,
              userName: session.user.name || 'Anonymous',
              workspaceId,
            });
          }
          if (conversationId) {
            broadcastToConversation(conversationId, RealtimeEventType.USER_LEFT, {
              userId: session.user.id,
              userName: session.user.name || 'Anonymous',
              conversationId,
            });
          }

          if (sseClients.size === 0) {
            stopCleanupInterval();
          }
        });
      },

      cancel() {
        sseClients.delete(clientId);

        // Broadcast user_left
        if (workspaceId) {
          broadcastToWorkspace(workspaceId, RealtimeEventType.USER_LEFT, {
            userId: session.user.id,
            workspaceId,
          });
        }
        if (conversationId) {
          broadcastToConversation(conversationId, RealtimeEventType.USER_LEFT, {
            userId: session.user.id,
            conversationId,
          });
        }

        if (sseClients.size === 0) {
          stopCleanupInterval();
        }
      },
    });

    // Log connection
    await logAuditEvent({
      event: AuditEvent.CHAT_CREATED,
      userId: session.user.id,
      workspaceId,
      metadata: {
        type: 'sse_connection',
        clientId,
        conversationId,
        documentId,
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to establish SSE connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SSE_ERROR',
          message: 'Failed to establish SSE connection',
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST Handler - Server-side Broadcast
// =============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Verify API key or internal auth
    const apiKey = req.headers.get('x-api-key');
    const internalSecret = req.headers.get('x-internal-secret');

    const isAuthorized =
      apiKey === process.env.INTERNAL_API_KEY || internalSecret === process.env.INTERNAL_SECRET;

    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid API key or internal secret',
          },
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { action, target, targetId, eventType, data, excludeUserId } = body;

    if (action !== 'broadcast' || !target || !targetId || !eventType) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required fields',
          },
        },
        { status: 400 }
      );
    }

    let clientCount = 0;

    switch (target) {
      case 'workspace': {
        // Find client ID to exclude if excludeUserId provided
        let excludeClientId: string | undefined;
        if (excludeUserId) {
          for (const [id, client] of sseClients.entries()) {
            if (client.userId === excludeUserId) {
              excludeClientId = id;
              break;
            }
          }
        }
        broadcastToWorkspace(targetId, eventType as RealtimeEventType, data || {}, excludeClientId);

        // Count affected clients
        for (const client of sseClients.values()) {
          if (client.workspaceId === targetId) clientCount++;
        }
        break;
      }

      case 'conversation': {
        let excludeClientId: string | undefined;
        if (excludeUserId) {
          for (const [id, client] of sseClients.entries()) {
            if (client.userId === excludeUserId) {
              excludeClientId = id;
              break;
            }
          }
        }
        broadcastToConversation(
          targetId,
          eventType as RealtimeEventType,
          data || {},
          excludeClientId
        );

        for (const client of sseClients.values()) {
          if (client.conversationId === targetId) clientCount++;
        }
        break;
      }

      case 'document': {
        let excludeClientId: string | undefined;
        if (excludeUserId) {
          for (const [id, client] of sseClients.entries()) {
            if (client.userId === excludeUserId) {
              excludeClientId = id;
              break;
            }
          }
        }
        broadcastToDocument(targetId, eventType as RealtimeEventType, data || {}, excludeClientId);

        for (const client of sseClients.values()) {
          if (client.documentId === targetId) clientCount++;
        }
        break;
      }

      case 'user': {
        sendToUser(targetId, eventType as RealtimeEventType, data || {});
        clientCount = 1;
        break;
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_TARGET',
              message: `Unknown target: ${target}`,
            },
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: {
        sent: true,
        target,
        targetId,
        eventType,
        clientCount,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to broadcast event', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BROADCAST_ERROR',
          message: 'Failed to broadcast event',
        },
      },
      { status: 500 }
    );
  }
}
