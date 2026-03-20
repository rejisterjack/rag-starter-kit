/**
 * Collaborative Features
 * 
 * - Share conversations via link
 * - Add comments/annotations to responses
 * - @mentions in workspace
 */

import { prisma } from '@/lib/db';
import { randomBytes } from 'crypto';
import type { Message } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ShareLink {
  id: string;
  conversationId: string;
  token: string;
  expiresAt?: Date;
  permissions: SharePermissions;
  accessCount: number;
  createdBy: string;
  createdAt: Date;
}

export interface SharePermissions {
  canView: boolean;
  canComment: boolean;
  canFork: boolean;
}

export interface Comment {
  id: string;
  messageId: string;
  conversationId: string;
  userId: string;
  userName: string;
  content: string;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
  replies?: Comment[];
}

export interface Annotation {
  id: string;
  messageId: string;
  conversationId: string;
  userId: string;
  content: string;
  highlightedText?: string;
  position?: { start: number; end: number };
  createdAt: Date;
}

export interface Mention {
  id: string;
  messageId: string;
  conversationId: string;
  mentionedUserId: string;
  mentionedByUserId: string;
  content: string;
  read: boolean;
  createdAt: Date;
}

// ============================================================================
// Share Links
// ============================================================================

/**
 * Create a shareable link for a conversation
 */
export async function createShareLink(
  conversationId: string,
  userId: string,
  options: {
    expiresInDays?: number;
    permissions?: Partial<SharePermissions>;
  } = {}
): Promise<ShareLink> {
  const { expiresInDays, permissions = {} } = options;

  // Check if user has access to the conversation
  const conversation = await prisma.chat.findFirst({
    where: {
      id: conversationId,
      userId,
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }

  // Generate unique token
  const token = randomBytes(32).toString('hex');

  const shareLink = await prisma.shareLink.create({
    data: {
      conversationId,
      token,
      createdBy: userId,
      expiresAt: expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null,
      permissions: {
        canView: true,
        canComment: permissions.canComment ?? false,
        canFork: permissions.canFork ?? true,
      },
    },
  });

  return {
    id: shareLink.id,
    conversationId: shareLink.conversationId,
    token: shareLink.token,
    expiresAt: shareLink.expiresAt ?? undefined,
    permissions: shareLink.permissions as SharePermissions,
    accessCount: shareLink.accessCount,
    createdBy: shareLink.createdBy,
    createdAt: shareLink.createdAt,
  };
}

/**
 * Get conversation by share token
 */
export async function getConversationByShareToken(
  token: string
): Promise<{
  conversation: {
    id: string;
    title: string;
    messages: Message[];
  };
  permissions: SharePermissions;
} | null> {
  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
    include: {
      conversation: {
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });

  if (!shareLink) return null;

  // Check expiration
  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
    return null;
  }

  // Increment access count
  await prisma.shareLink.update({
    where: { id: shareLink.id },
    data: { accessCount: { increment: 1 } },
  });

  return {
    conversation: {
      id: shareLink.conversation.id,
      title: shareLink.conversation.title,
      messages: shareLink.conversation.messages as unknown as Message[],
    },
    permissions: shareLink.permissions as SharePermissions,
  };
}

/**
 * Revoke a share link
 */
export async function revokeShareLink(
  shareId: string,
  userId: string
): Promise<void> {
  const shareLink = await prisma.shareLink.findFirst({
    where: {
      id: shareId,
      createdBy: userId,
    },
  });

  if (!shareLink) {
    throw new Error('Share link not found or access denied');
  }

  await prisma.shareLink.delete({
    where: { id: shareId },
  });
}

/**
 * List share links for a conversation
 */
export async function listShareLinks(
  conversationId: string,
  userId: string
): Promise<ShareLink[]> {
  const links = await prisma.shareLink.findMany({
    where: {
      conversationId,
      createdBy: userId,
    },
    orderBy: { createdAt: 'desc' },
  });

  return links.map((link) => ({
    id: link.id,
    conversationId: link.conversationId,
    token: link.token,
    expiresAt: link.expiresAt ?? undefined,
    permissions: link.permissions as SharePermissions,
    accessCount: link.accessCount,
    createdBy: link.createdBy,
    createdAt: link.createdAt,
  }));
}

// ============================================================================
// Comments
// ============================================================================

/**
 * Add a comment to a message
 */
export async function addComment(
  messageId: string,
  userId: string,
  content: string,
  parentId?: string
): Promise<Comment> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { chat: true },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const comment = await prisma.comment.create({
    data: {
      messageId,
      conversationId: message.chatId,
      userId,
      content,
      parentId: parentId || null,
    },
  });

  return {
    id: comment.id,
    messageId: comment.messageId,
    conversationId: comment.conversationId,
    userId: comment.userId,
    userName: user.name ?? user.email ?? 'Unknown',
    content: comment.content,
    resolved: comment.resolved,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

/**
 * Get comments for a conversation
 */
export async function getComments(
  conversationId: string
): Promise<Comment[]> {
  const comments = await prisma.comment.findMany({
    where: { conversationId },
    include: {
      user: {
        select: { name: true, email: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Build comment tree
  const commentMap = new Map<string, Comment>();
  const rootComments: Comment[] = [];

  for (const comment of comments) {
    const formatted: Comment = {
      id: comment.id,
      messageId: comment.messageId,
      conversationId: comment.conversationId,
      userId: comment.userId,
      userName: comment.user?.name ?? comment.user?.email ?? 'Unknown',
      content: comment.content,
      resolved: comment.resolved,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      replies: [],
    };

    commentMap.set(comment.id, formatted);

    if (comment.parentId) {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.replies = parent.replies ?? [];
        parent.replies.push(formatted);
      }
    } else {
      rootComments.push(formatted);
    }
  }

  return rootComments;
}

/**
 * Resolve a comment
 */
export async function resolveComment(
  commentId: string,
  userId: string
): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    throw new Error('Comment not found');
  }

  // Allow resolver if they're the commenter or conversation owner
  const conversation = await prisma.chat.findUnique({
    where: { id: comment.conversationId },
  });

  if (comment.userId !== userId && conversation?.userId !== userId) {
    throw new Error('Permission denied');
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: { resolved: true },
  });
}

/**
 * Delete a comment
 */
export async function deleteComment(
  commentId: string,
  userId: string
): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    throw new Error('Comment not found');
  }

  if (comment.userId !== userId) {
    throw new Error('Permission denied');
  }

  await prisma.comment.delete({
    where: { id: commentId },
  });
}

// ============================================================================
// Annotations
// ============================================================================

/**
 * Add an annotation to a message
 */
export async function addAnnotation(
  messageId: string,
  userId: string,
  content: string,
  options?: {
    highlightedText?: string;
    position?: { start: number; end: number };
  }
): Promise<Annotation> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { chat: true },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  const annotation = await prisma.annotation.create({
    data: {
      messageId,
      conversationId: message.chatId,
      userId,
      content,
      highlightedText: options?.highlightedText,
      position: options?.position,
    },
  });

  return {
    id: annotation.id,
    messageId: annotation.messageId,
    conversationId: annotation.conversationId,
    userId: annotation.userId,
    content: annotation.content,
    highlightedText: annotation.highlightedText ?? undefined,
    position: (annotation.position as { start: number; end: number }) ?? undefined,
    createdAt: annotation.createdAt,
  };
}

/**
 * Get annotations for a conversation
 */
export async function getAnnotations(
  conversationId: string
): Promise<Annotation[]> {
  const annotations = await prisma.annotation.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
  });

  return annotations.map((a) => ({
    id: a.id,
    messageId: a.messageId,
    conversationId: a.conversationId,
    userId: a.userId,
    content: a.content,
    highlightedText: a.highlightedText ?? undefined,
    position: (a.position as { start: number; end: number }) ?? undefined,
    createdAt: a.createdAt,
  }));
}

// ============================================================================
// @Mentions
// ============================================================================

/**
 * Process mentions in a message and create notifications
 */
export async function processMentions(
  messageId: string,
  content: string,
  senderUserId: string
): Promise<Mention[]> {
  // Extract mentions (@username or @user-id)
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
  const mentions: Mention[] = [];
  let match: RegExpExecArray | null;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { chat: true },
  });

  if (!message) {
    throw new Error('Message not found');
  }

  const mentionedUsernames = new Set<string>();

  while ((match = mentionRegex.exec(content)) !== null) {
    const username = match[1];
    if (mentionedUsernames.has(username)) continue;
    mentionedUsernames.add(username);

    // Try to find user by name or email
    const mentionedUser = await prisma.user.findFirst({
      where: {
        OR: [
          { name: { equals: username, mode: 'insensitive' } },
          { email: { startsWith: username, mode: 'insensitive' } },
        ],
      },
    });

    if (mentionedUser && mentionedUser.id !== senderUserId) {
      const mention = await prisma.mention.create({
        data: {
          messageId,
          conversationId: message.chatId,
          mentionedUserId: mentionedUser.id,
          mentionedByUserId: senderUserId,
          content: content.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
        },
      });

      mentions.push({
        id: mention.id,
        messageId: mention.messageId,
        conversationId: mention.conversationId,
        mentionedUserId: mention.mentionedUserId,
        mentionedByUserId: mention.mentionedByUserId,
        content: mention.content,
        read: mention.read,
        createdAt: mention.createdAt,
      });
    }
  }

  return mentions;
}

/**
 * Get unread mentions for a user
 */
export async function getUnreadMentions(userId: string): Promise<Mention[]> {
  const mentions = await prisma.mention.findMany({
    where: {
      mentionedUserId: userId,
      read: false,
    },
    include: {
      mentionedBy: {
        select: { name: true, email: true },
      },
      conversation: {
        select: { title: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return mentions.map((m) => ({
    id: m.id,
    messageId: m.messageId,
    conversationId: m.conversationId,
    mentionedUserId: m.mentionedUserId,
    mentionedByUserId: m.mentionedByUserId,
    content: m.content,
    read: m.read,
    createdAt: m.createdAt,
  }));
}

/**
 * Mark mentions as read
 */
export async function markMentionsAsRead(
  mentionIds: string[],
  userId: string
): Promise<void> {
  await prisma.mention.updateMany({
    where: {
      id: { in: mentionIds },
      mentionedUserId: userId,
    },
    data: { read: true },
  });
}

// ============================================================================
// Export
// ============================================================================

// Types are already exported above
