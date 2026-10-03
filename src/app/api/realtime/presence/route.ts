/**
 * Presence API Route
 * POST: Update user presence
 * GET: Get users in a workspace/chat
 */

import type { NextRequest, NextResponse } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
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
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    // Check if Redis is configured
    if (!isRedisConfigured()) {
      return apiError('REDIS_NOT_CONFIGURED', 'Real-time features are not available', 503);
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

      const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
      return apiError(
        'RATE_LIMITED',
        'Too many presence updates',
        429,
        { retryAfter },
        { 'Retry-After': retryAfter.toString() }
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

        return apiSuccess({
          userId,
          status: status || 'online',
          timestamp: Date.now(),
        });
      }

      case 'heartbeat': {
        // Keep presence alive
        await heartbeat(userId);

        return apiSuccess({
          userId,
          timestamp: Date.now(),
        });
      }

      case 'status': {
        // Update status only
        if (!status) {
          return apiError('MISSING_STATUS', 'Status is required', 400);
        }

        await setUserStatus(userId, status as PresenceStatus);

        return apiSuccess({
          userId,
          status,
          timestamp: Date.now(),
        });
      }

      case 'view': {
        // Update current view
        await setCurrentView(userId, currentView);

        return apiSuccess({
          userId,
          currentView,
          timestamp: Date.now(),
        });
      }

      case 'typing': {
        // Update typing status
        if (typeof isTyping !== 'boolean') {
          return apiError('INVALID_TYPING', 'isTyping boolean is required', 400);
        }

        const { setTyping } = await import('@/lib/realtime/presence');
        await setTyping(userId, typingIn || 'default', isTyping, userInfo);

        return apiSuccess({
          userId,
          isTyping,
          typingIn: typingIn || 'default',
          timestamp: Date.now(),
        });
      }

      case 'cursor': {
        // Update cursor position
        if (!cursor || typeof cursor.x !== 'number' || typeof cursor.y !== 'number') {
          return apiError('INVALID_CURSOR', 'Cursor position with x and y is required', 400);
        }

        const { updateCursor } = await import('@/lib/realtime/presence');
        const roomId = body.roomId || 'default';
        await updateCursor(userId, roomId, cursor, userInfo);

        return apiSuccess({
          userId,
          cursor,
          roomId,
          timestamp: Date.now(),
        });
      }

      case 'leave': {
        // User is leaving
        await removePresence(userId);

        return apiSuccess({
          userId,
          timestamp: Date.now(),
        });
      }

      default:
        return apiError(
          'INVALID_ACTION',
          `Unknown action: ${action}. Valid actions: join, heartbeat, status, view, typing, cursor, leave`,
          400
        );
    }
  } catch (error: unknown) {
    logger.error('Failed to update presence', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to update presence', 500);
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
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    // Check if Redis is configured
    if (!isRedisConfigured()) {
      return apiSuccess({
        users: [],
        count: 0,
        redisEnabled: false,
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
      return apiSuccess({
        presence,
        found: !!presence,
      });
    }

    // If roomId is provided, get all users in that room
    if (roomId) {
      const users = await getUsersInRoom(roomType, roomId);

      // Filter out current user
      const otherUsers = users.filter((u) => u.user.id !== session.user.id);

      return apiSuccess({
        users: otherUsers,
        count: otherUsers.length,
        totalInRoom: users.length,
        roomType,
        roomId,
      });
    }

    // If neither provided, return error
    return apiError('MISSING_PARAMS', 'Either roomId or userId is required', 400);
  } catch (error: unknown) {
    logger.error('Failed to get presence data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to get presence data', 500);
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
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    if (!isRedisConfigured()) {
      return apiSuccess({
        message: 'Redis not configured, nothing to remove',
      });
    }

    await removePresence(session.user.id);

    return apiSuccess({
      userId: session.user.id,
      timestamp: Date.now(),
    });
  } catch (error: unknown) {
    logger.error('Failed to remove presence', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return apiError('INTERNAL_ERROR', 'Failed to remove presence', 500);
  }
}
