/**
 * Message Feedback API
 * POST /api/messages/[id]/feedback - Submit feedback for a message
 * GET /api/messages/[id]/feedback - Get feedback for a message
 * DELETE /api/messages/[id]/feedback - Remove feedback
 */

import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth, withApiAuth } from '@/lib/auth';
import { prisma, prismaRead } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { checkApiRateLimit } from '@/lib/security/rate-limiter';

// Validation schema for feedback submission
const feedbackSchema = z.object({
  rating: z.enum(['UP', 'DOWN']),
  comment: z.string().max(2000).optional(),
  categories: z.array(z.string().max(50)).max(10).optional(),
});

/**
 * POST /api/messages/[id]/feedback
 * Submit feedback for a message
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: messageId } = await params;

    // Authenticate user (optional - feedback can be anonymous)
    const session = await auth();
    const userId = session?.user?.id;

    // Check rate limit
    const rateLimitIdentifier = `feedback:${userId || 'anonymous'}`;
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'feedback');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many feedback submissions', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = feedbackSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: `Invalid feedback data: ${validation.error.errors.map((e) => e.message).join(', ')}`,
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const { rating, comment, categories } = validation.data;

    // Verify message exists and get chat info for authorization
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        chat: {
          select: {
            id: true,
            userId: true,
            title: true,
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Only allow feedback on assistant messages
    if (message.role !== 'ASSISTANT') {
      return NextResponse.json(
        {
          error: 'Feedback can only be submitted for assistant messages',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Get client info for analytics
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'unknown';
    const userAgent = headersList.get('user-agent') || undefined;

    // Upsert feedback (create or update)
    const feedback = await prisma.messageFeedback.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId: userId || '',
        },
      },
      update: {
        rating,
        comment,
        categories: categories || [],
        ipAddress,
        userAgent,
      },
      create: {
        messageId,
        rating,
        comment,
        categories: categories || [],
        userId,
        ipAddress,
        userAgent,
      },
    });

    logger.info('Message feedback submitted');

    return NextResponse.json({
      success: true,
      data: {
        id: feedback.id,
        messageId: feedback.messageId,
        rating: feedback.rating,
        comment: feedback.comment,
        categories: feedback.categories,
        createdAt: feedback.createdAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to submit message feedback', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    return NextResponse.json(
      { error: 'Failed to submit feedback', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/messages/[id]/feedback
 * Get feedback for a message
 */
export const GET = withApiAuth(
  async (
    _req: NextRequest,
    session,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<NextResponse> => {
    try {
      const { id: messageId } = await params;

      // Verify message exists and user has access
      const message = await prismaRead.message.findUnique({
        where: { id: messageId },
        include: {
          chat: {
            select: { userId: true },
          },
        },
      });

      if (!message) {
        return NextResponse.json(
          { error: 'Message not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      // Only message owner or admin can view feedback
      const isOwner = message.chat.userId === session.user.id;
      const isAdmin = session.user.role === 'ADMIN';

      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 });
      }

      // Get feedback statistics
      const feedbacks = await prismaRead.messageFeedback.findMany({
        where: { messageId },
        select: {
          id: true,
          rating: true,
          comment: true,
          categories: true,
          createdAt: true,
          userId: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const stats = {
        total: feedbacks.length,
        upvotes: feedbacks.filter((f: { rating: string }) => f.rating === 'UP').length,
        downvotes: feedbacks.filter((f: { rating: string }) => f.rating === 'DOWN').length,
      };

      return NextResponse.json({
        success: true,
        data: {
          stats,
          feedbacks: feedbacks.map(
            (f: {
              id: string;
              rating: string;
              comment: string | null;
              categories: string[];
              createdAt: Date;
              userId: string | null;
            }) => ({
              id: f.id,
              rating: f.rating,
              comment: f.comment,
              categories: f.categories,
              createdAt: f.createdAt.toISOString(),
              isOwn: f.userId === session.user.id,
            })
          ),
        },
      });
    } catch (error: unknown) {
      logger.error('Failed to get message feedback', {
        error: error instanceof Error ? error.message : 'Unknown',
      });

      return NextResponse.json(
        { error: 'Failed to get feedback', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  }
);

/**
 * DELETE /api/messages/[id]/feedback
 * Remove feedback for a message
 */
export const DELETE = withApiAuth(
  async (
    _req: NextRequest,
    session,
    { params }: { params: Promise<{ id: string }> }
  ): Promise<NextResponse> => {
    try {
      const { id: messageId } = await params;

      const userId = session.user.id;

      // Delete the user's feedback for this message
      await prisma.messageFeedback.deleteMany({
        where: {
          messageId,
          userId,
        },
      });

      logger.info('Message feedback deleted');

      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      logger.error('Failed to delete message feedback', {
        error: error instanceof Error ? error.message : 'Unknown',
      });

      return NextResponse.json(
        { error: 'Failed to delete feedback', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  }
);
