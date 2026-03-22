/**
 * Chat Sharing API
 * POST /api/chat/[id]/share - Create/update share settings
 * GET /api/chat/[id]/share - Get share settings
 * DELETE /api/chat/[id]/share - Remove sharing
 */

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { checkApiRateLimit } from '@/lib/security/rate-limiter';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

// Validation schema for share settings
const shareSchema = z.object({
  isPublic: z.boolean().default(false),
  allowComments: z.boolean().default(false),
  expiresAt: z.string().datetime().optional().nullable(),
});

/**
 * POST /api/chat/[id]/share
 * Create or update share settings for a chat
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: chatId } = await params;
    
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // Check rate limit
    const rateLimitIdentifier = `share:${userId}`;
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'share');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many share requests', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }
    
    // Verify chat exists and user owns it
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, userId: true, title: true },
    });
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }
    
    if (chat.userId !== userId) {
      return NextResponse.json(
        { error: 'Only the chat owner can share it', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }
    
    // Parse and validate request body
    const body = await req.json();
    const validation = shareSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: `Invalid share settings: ${validation.error.errors.map(e => e.message).join(', ')}`,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }
    
    const { isPublic, allowComments, expiresAt } = validation.data;
    
    // Upsert share settings
    const share = await prisma.chatShare.upsert({
      where: { chatId },
      update: {
        isPublic,
        allowComments,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      create: {
        chatId,
        isPublic,
        allowComments,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: userId,
      },
    });
    
    // Generate share URL
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/share/${share.shareToken}`;
    
    logger.info('Chat share settings updated');
    
    return NextResponse.json({
      success: true,
      data: {
        id: share.id,
        chatId: share.chatId,
        shareToken: share.shareToken,
        shareUrl,
        isPublic: share.isPublic,
        allowComments: share.allowComments,
        expiresAt: share.expiresAt?.toISOString() || null,
        viewCount: share.viewCount,
        createdAt: share.createdAt.toISOString(),
      }
    });
  } catch (error) {
    logger.error('Failed to update chat share settings');
    
    return NextResponse.json(
      { error: 'Failed to update share settings', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat/[id]/share
 * Get share settings for a chat
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: chatId } = await params;
    
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // Verify chat exists and user owns it
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, userId: true },
    });
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }
    
    if (chat.userId !== userId) {
      return NextResponse.json(
        { error: 'Only the chat owner can view share settings', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }
    
    // Get share settings
    const share = await prisma.chatShare.findUnique({
      where: { chatId },
    });
    
    if (!share) {
      return NextResponse.json({
        success: true,
        data: {
          isShared: false,
          shareUrl: null,
          isPublic: false,
          allowComments: false,
          expiresAt: null,
          viewCount: 0,
        }
      });
    }
    
    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/share/${share.shareToken}`;
    
    return NextResponse.json({
      success: true,
      data: {
        isShared: true,
        id: share.id,
        shareToken: share.shareToken,
        shareUrl,
        isPublic: share.isPublic,
        allowComments: share.allowComments,
        expiresAt: share.expiresAt?.toISOString() || null,
        viewCount: share.viewCount,
        lastViewedAt: share.lastViewedAt?.toISOString() || null,
        createdAt: share.createdAt.toISOString(),
      }
    });
  } catch (error) {
    logger.error('Failed to get chat share settings');
    
    return NextResponse.json(
      { error: 'Failed to get share settings', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/[id]/share
 * Remove sharing for a chat
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: chatId } = await params;
    
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    const userId = session.user.id;
    
    // Verify chat exists and user owns it
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { id: true, userId: true },
    });
    
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }
    
    if (chat.userId !== userId) {
      return NextResponse.json(
        { error: 'Only the chat owner can remove sharing', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }
    
    // Delete share settings
    await prisma.chatShare.deleteMany({
      where: { chatId },
    });
    
    logger.info('Chat sharing removed');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to remove chat sharing');
    
    return NextResponse.json(
      { error: 'Failed to remove sharing', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
