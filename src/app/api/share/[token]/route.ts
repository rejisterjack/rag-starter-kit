/**
 * Public Chat Share API
 * GET /api/share/[token] - View a shared chat
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { checkApiRateLimit } from '@/lib/security/rate-limiter';

/**
 * GET /api/share/[token]
 * Get a shared chat by token
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;

    // Check rate limit
    const rateLimitIdentifier = `share_view:${token}`;
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'share_view');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    // Find the share by token
    const share = await prisma.chatShare.findUnique({
      where: { shareToken: token },
      include: {
        chat: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
            messages: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                content: true,
                role: true,
                sources: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!share) {
      return NextResponse.json(
        { error: 'Shared chat not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if share has expired
    if (share.expiresAt && new Date() > share.expiresAt) {
      return NextResponse.json(
        { error: 'This shared chat has expired', code: 'GONE' },
        { status: 410 }
      );
    }

    // Check if share is public or user is the owner
    const session = await auth();
    const isOwner = session?.user?.id === share.chat.user.id;

    if (!share.isPublic && !isOwner) {
      return NextResponse.json(
        { error: 'This chat is not publicly shared', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Update view count and last viewed
    await prisma.chatShare.update({
      where: { id: share.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
      },
    });

    logger.info('Shared chat viewed');

    return NextResponse.json({
      success: true,
      data: {
        share: {
          id: share.id,
          isPublic: share.isPublic,
          allowComments: share.allowComments,
          expiresAt: share.expiresAt?.toISOString() || null,
          viewCount: share.viewCount + 1,
          createdAt: share.createdAt.toISOString(),
        },
        chat: {
          id: share.chat.id,
          title: share.chat.title,
          createdAt: share.chat.createdAt.toISOString(),
          owner: {
            id: share.chat.user.id,
            name: share.chat.user.name,
            image: share.chat.user.image,
          },
          messages: share.chat.messages.map(
            (msg: {
              id: string;
              content: string;
              role: string;
              sources: unknown;
              createdAt: Date;
            }) => ({
              id: msg.id,
              content: msg.content,
              role: msg.role,
              sources: msg.sources,
              createdAt: msg.createdAt.toISOString(),
            })
          ),
          messageCount: share.chat.messages.length,
        },
      },
    });
  } catch (_error) {
    logger.error('Failed to get shared chat');

    return NextResponse.json(
      { error: 'Failed to get shared chat', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
