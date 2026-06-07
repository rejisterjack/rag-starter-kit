'use server';

import { revalidateTag } from 'next/cache';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createChatSchema, deleteChatSchema, updateChatTitleSchema } from '@/lib/validation';

interface ChatActionResult {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

/**
 * Server Action: Create a new chat.
 */
export async function createChat(rawTitle?: string, rawModel?: string): Promise<ChatActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Authentication required' };
  }

  const parsed = createChatSchema.safeParse({ title: rawTitle, model: rawModel });
  if (!parsed.success) {
    return { success: false, error: 'Invalid input' };
  }
  const { title } = parsed.data;

  try {
    const chat = await prisma.chat.create({
      data: {
        title: title || 'New Chat',
        model: 'openrouter',
        userId: session.user.id,
        workspaceId: session.user.workspaceId,
      },
    });

    revalidateTag(`user-chats-${session.user.id}`, 'default');

    return {
      success: true,
      data: {
        id: chat.id,
        title: chat.title,
        model: chat.model,
        createdAt: chat.createdAt.toISOString(),
      },
    };
  } catch (error) {
    logger.warn('Create chat action failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Failed to create chat' };
  }
}

/**
 * Server Action: Delete a chat.
 */
export async function deleteChat(rawChatId: string): Promise<ChatActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Authentication required' };
  }

  const parsed = deleteChatSchema.safeParse({ chatId: rawChatId });
  if (!parsed.success) {
    return { success: false, error: 'Invalid chat ID' };
  }
  const { chatId } = parsed.data;

  try {
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [{ userId: session.user.id }, { workspaceId: session.user.workspaceId ?? '' }],
      },
    });

    if (!chat) {
      return { success: false, error: 'Chat not found' };
    }

    await prisma.chat.delete({ where: { id: chatId } });

    revalidateTag(`user-chats-${session.user.id}`, 'default');

    return { success: true };
  } catch (error) {
    logger.warn('Delete chat action failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Failed to delete chat' };
  }
}

/**
 * Server Action: Update chat title.
 */
export async function updateChatTitle(
  rawChatId: string,
  rawTitle: string
): Promise<ChatActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Authentication required' };
  }

  const parsed = updateChatTitleSchema.safeParse({ chatId: rawChatId, title: rawTitle });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { chatId, title } = parsed.data;

  try {
    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        OR: [{ userId: session.user.id }, { workspaceId: session.user.workspaceId ?? '' }],
      },
    });

    if (!chat) {
      return { success: false, error: 'Chat not found' };
    }

    await prisma.chat.update({
      where: { id: chatId },
      data: { title: title.trim() },
    });

    return { success: true };
  } catch (error) {
    logger.warn('Update chat title action failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return { success: false, error: 'Failed to update chat title' };
  }
}
