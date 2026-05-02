/**
 * Socket.io API Route Handler for Next.js
 * Initializes the WebSocket server and handles Socket.io requests
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import type { UserInfo } from '@/lib/realtime/types';

// =============================================================================
// Socket.io Handler
// =============================================================================

/**
 * GET handler for Socket.io initial connection
 * This route initializes the WebSocket server if not already running
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    // In production, Socket.io typically runs on a separate server
    // This endpoint returns the Socket.io configuration to the client

    const socketConfig = {
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      path: '/api/socket/io',
      transports: ['websocket', 'polling'],
    };

    return NextResponse.json({
      success: true,
      config: socketConfig,
    });
  } catch (error: unknown) {
    logger.error('Failed to get socket configuration', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SOCKET_CONFIG_ERROR',
          message: 'Failed to get socket configuration',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler for Socket.io-related actions
 * Can be used for server-side emits or room management
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { action, roomId, event, data } = body;

    switch (action) {
      case 'broadcast': {
        // Server-side broadcast to a room
        // This requires the WebSocket server to be initialized elsewhere
        const { getIO } = await import('@/lib/realtime/websocket-server');
        const io = getIO();

        if (!io) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'SERVER_NOT_READY',
                message: 'WebSocket server not initialized',
              },
            },
            { status: 503 }
          );
        }

        if (roomId && event) {
          io.to(roomId).emit(event, data);
        }

        return NextResponse.json({ success: true });
      }

      case 'getRoomInfo': {
        const { getRoomMembers } = await import('@/lib/realtime/websocket-server');
        const members = roomId ? getRoomMembers(roomId) : [];

        return NextResponse.json({
          success: true,
          data:
            members.length > 0
              ? {
                  memberCount: members.length,
                  members: members.map(
                    (m: { user: UserInfo; joinedAt: Date; isTyping: boolean }) => ({
                      user: m.user,
                      joinedAt: m.joinedAt,
                      isTyping: m.isTyping,
                    })
                  ),
                }
              : null,
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_ACTION',
              message: `Unknown action: ${action}`,
            },
          },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    logger.error('Socket POST handler failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SOCKET_ACTION_ERROR',
          message: 'Failed to process socket action',
        },
      },
      { status: 500 }
    );
  }
}
