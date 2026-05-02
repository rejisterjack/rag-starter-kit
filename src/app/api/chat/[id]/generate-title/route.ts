/**
 * Chat Title Generation API
 * POST /api/chat/[id]/generate-title
 *
 * Automatically generates a concise title for a chat based on the first user message.
 */

import { openrouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Generate a concise title from the first user message
 */
export const POST = withApiAuth(async (_req: Request, session, { params }: RouteParams) => {
  try {
    const userId = session.user.id;
    const { id: chatId } = await params;

    // Verify user has access to this chat
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [{ userId }, { workspaceId: session.user.workspaceId ?? '' }],
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Get the first user message
    const firstMessage = chat.messages[0];
    if (!firstMessage) {
      return NextResponse.json(
        { error: 'No messages found in chat', code: 'NO_MESSAGES' },
        { status: 400 }
      );
    }

    // Skip if title is already set and not "New Chat"
    if (chat.title && chat.title !== 'New Chat') {
      return NextResponse.json({
        success: true,
        data: { title: chat.title, generated: false },
      });
    }

    // Generate title using LLM
    const prompt = `Generate a concise, descriptive title (4-6 words) for a conversation that starts with this message. Be specific but brief. Only return the title, no quotes or extra text.

Message: "${firstMessage.content.slice(0, 500)}"`;

    const result = await generateText({
      model: openrouter.chat('mistralai/mistral-7b-instruct:free'),
      prompt,
      maxTokens: 20,
      temperature: 0.7,
    });

    // Clean up the generated title
    let generatedTitle = result.text.trim().replace(/^["']|["']$/g, '');

    // Fallback if generation fails or returns empty
    if (!generatedTitle || generatedTitle.length < 3) {
      // Use first 30 chars of message as fallback
      generatedTitle = `${firstMessage.content.slice(0, 30).trim()}...`;
    }

    // Limit to 50 characters
    if (generatedTitle.length > 50) {
      generatedTitle = `${generatedTitle.slice(0, 47).trim()}...`;
    }

    // Update chat with generated title
    await prisma.chat.update({
      where: { id: chatId },
      data: { title: generatedTitle },
    });

    logger.info('Generated chat title', {
      chatId,
      userId,
      title: generatedTitle,
    });

    return NextResponse.json({
      success: true,
      data: {
        title: generatedTitle,
        generated: true,
      },
    });
  } catch (error) {
    logger.warn('Failed to generate chat title', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to generate title', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
});
