/**
 * Presence API Route
 * POST: Update user presence
 * GET: Get users in a workspace/chat
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import {
  getUserPresence,
  getUsersInRoom,
  heartbeat,
  isRedisConfigured,
  removePresence,
  setCurrentView,
  setUserStatus,
  updatePresence,
} from '@/lib/realtime/presence';
import type { PresenceStatus } from '@/lib/realtime/types';
import { getRateLimiter } from '@/lib/security/rate-limiter';

// =============================================================================
// POST Handler - Update User Presence
// =============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
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

    // Check if Redis is configured
    if (!isRedisConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'REDIS_NOT_CONFIGURED',
            message: 'Real-time features are not available',
          },
        },
        { status: 503 }
      );
    }

    // Check rate limit
    const rateLimiter = getRateLimiter();
    const rateLimitResult = await rateLimiter.checkLimit(`presence:${session.user.id}`, {
      limit: 30,
      windowMs: 60 * 1000, // 1 minute
      prefix: 'presence_updates',
    });

    if (!rateLimitResult.success) {
      await logAuditEvent({
        event: AuditEvent.RATE_LIMIT_HIT,
        userId: session.user.id,
        metadata: {
          type: 'presence_update',
          endpoint: '/api/realtime/presence',
        },
        severity: 'WARNING',
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many presence updates',
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

    // Parse request body
    const body = await req.json();
    const { action, status, currentView, isTyping, typingIn, cursor } = body;

    const userId = session.user.id;
    const userInfo = {
      id: userId,
      name: session.user.name || 'Anonymous',
      email: session.user.email || '',
      image: session.user.image,
      role: session.user.role || 'USER',
    };

    switch (action) {
      case 'join': {
        // User is joining/reconnecting
        await updatePresence(userId, {
          user: userInfo,
          status: status || 'online',
          currentView,
        });

        await logAuditEvent({
          event: AuditEvent.CHAT_CREATED,
          userId,
          workspaceId: currentView?.type === 'workspace' ? currentView.id : undefined,
          metadata: {
            type: 'presence_join',
            view: currentView,
          },
        });

        return NextResponse.json({
          success: true,
          data: {
            userId,
            status: status || 'online',
            timestamp: Date.now(),
          },
        });
      }

      case 'heartbeat': {
        // Keep presence alive
        await heartbeat(userId);

        return NextResponse.json({
          success: true,
          data: {
            userId,
            timestamp: Date.now(),
          },
        });
      }

      case 'status': {
        // Update status only
        if (!status) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'MISSING_STATUS',
                message: 'Status is required',
              },
            },
            { status: 400 }
          );
        }

        await setUserStatus(userId, status as PresenceStatus);

        return NextResponse.json({
          success: true,
          data: {
            userId,
            status,
            timestamp: Date.now(),
          },
        });
      }

      case 'view': {
        // Update current view
        await setCurrentView(userId, currentView);

        return NextResponse.json({
          success: true,
          data: {
            userId,
            currentView,
            timestamp: Date.now(),
          },
        });
      }

      case 'typing': {
        // Update typing status
        if (typeof isTyping !== 'boolean') {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_TYPING',
                message: 'isTyping boolean is required',
              },
            },
            { status: 400 }
          );
        }

        const { setTyping } = await import('@/lib/realtime/presence');
        await setTyping(userId, typingIn || 'default', isTyping, userInfo);

        return NextResponse.json({
          success: true,
          data: {
            userId,
            isTyping,
            typingIn: typingIn || 'default',
            timestamp: Date.now(),
          },
        });
      }

      case 'cursor': {
        // Update cursor position
        if (!cursor || typeof cursor.x !== 'number' || typeof cursor.y !== 'number') {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'INVALID_CURSOR',
                message: 'Cursor position with x and y is required',
              },
            },
            { status: 400 }
          );
        }

        const { updateCursor } = await import('@/lib/realtime/presence');
        const roomId = body.roomId || 'default';
        await updateCursor(userId, roomId, cursor, userInfo);

        return NextResponse.json({
          success: true,
          data: {
            userId,
            cursor,
            roomId,
            timestamp: Date.now(),
          },
        });
      }

      case 'leave': {
        // User is leaving
        await removePresence(userId);

        return NextResponse.json({
          success: true,
          data: {
            userId,
            timestamp: Date.now(),
          },
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_ACTION',
              message: `Unknown action: ${action}. Valid actions: join, heartbeat, status, view, typing, cursor, leave`,
            },
          },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    logger.error('Failed to update presence', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update presence',
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET Handler - Get Users in Room
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

    // Check if Redis is configured
    if (!isRedisConfigured()) {
      return NextResponse.json({
        success: true,
        data: {
          users: [],
          count: 0,
          redisEnabled: false,
        },
      });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const roomType = searchParams.get('roomType') || 'workspace';
    const roomId = searchParams.get('roomId');
    const userId = searchParams.get('userId');

    // If userId is provided, get specific user's presence
    if (userId) {
      const presence = await getUserPresence(userId);
      return NextResponse.json({
        success: true,
        data: {
          presence,
          found: !!presence,
        },
      });
    }

    // If roomId is provided, get all users in that room
    if (roomId) {
      const users = await getUsersInRoom(roomType, roomId);

      // Filter out current user
      const otherUsers = users.filter((u) => u.user.id !== session.user.id);

      return NextResponse.json({
        success: true,
        data: {
          users: otherUsers,
          count: otherUsers.length,
          totalInRoom: users.length,
          roomType,
          roomId,
        },
      });
    }

    // If neither provided, return error
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'Either roomId or userId is required',
        },
      },
      { status: 400 }
    );
  } catch (error: unknown) {
    logger.error('Failed to get presence data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get presence data',
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE Handler - Remove Presence
// =============================================================================

export async function DELETE(_req: NextRequest): Promise<NextResponse> {
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

    if (!isRedisConfigured()) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'Redis not configured, nothing to remove',
        },
      });
    }

    await removePresence(session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        userId: session.user.id,
        timestamp: Date.now(),
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to remove presence', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to remove presence',
        },
      },
      { status: 500 }
    );
  }
}
