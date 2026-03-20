/**
 * Conversation Branching
 *
 * Features for forking conversations, editing messages, and comparing
 * different response paths.
 */

import { prisma } from '@/lib/db';
import type { Message } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ConversationBranch {
  id: string;
  parentId: string | null;
  rootId: string;
  name: string;
  createdAt: Date;
  messageCount: number;
}

export interface BranchComparison {
  branchA: {
    id: string;
    messages: Message[];
  };
  branchB: {
    id: string;
    messages: Message[];
  };
  divergencePoint: string | null;
  differences: Array<{
    type: 'added' | 'removed' | 'modified';
    messageId?: string;
    description: string;
  }>;
}

export interface EditMessageResult {
  success: boolean;
  newBranchId?: string;
  error?: string;
}

// ============================================================================
// Fork Conversation
// ============================================================================

/**
 * Fork a conversation at a specific message point.
 * Creates a new conversation branch starting from the specified message.
 *
 * @param conversationId - The original conversation ID
 * @param messageId - The message ID to fork at (this message and all after are copied)
 * @param branchName - Optional name for the new branch
 * @returns The new conversation (branch) ID
 */
export async function forkConversation(
  conversationId: string,
  messageId: string,
  branchName?: string
): Promise<string> {
  // Get the original conversation
  const originalChat = await prisma.chat.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!originalChat) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  // Find the fork point
  const forkIndex = originalChat.messages.findIndex((m) => m.id === messageId);
  if (forkIndex === -1) {
    throw new Error(`Message not found: ${messageId}`);
  }

  // Messages to copy (from fork point onwards)
  const messagesToCopy = originalChat.messages.slice(forkIndex);

  // Create new conversation (branch)
  const newChat = await prisma.chat.create({
    data: {
      userId: originalChat.userId,
      title: branchName ?? `${originalChat.title} (Branch)`,
      // Store branch metadata
      metadata: {
        parentId: conversationId,
        forkMessageId: messageId,
        rootId: (originalChat.metadata as { rootId?: string })?.rootId ?? conversationId,
        isBranch: true,
      },
    },
  });

  // Copy messages to new conversation
  for (const msg of messagesToCopy) {
    await prisma.message.create({
      data: {
        chatId: newChat.id,
        content: msg.content,
        role: msg.role,
        sources: msg.sources ?? undefined,
        tokensUsed: msg.tokensUsed ?? undefined,
        // Preserve original timestamp for ordering
        createdAt: msg.createdAt,
      },
    });
  }

  return newChat.id;
}

/**
 * Create a quick branch (fork at last message)
 */
export async function quickBranch(conversationId: string, branchName?: string): Promise<string> {
  const chat = await prisma.chat.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!chat || chat.messages.length === 0) {
    throw new Error('Conversation is empty');
  }

  // Fork at the last user message
  const lastUserMessage = chat.messages.find((m) => m.role === 'USER');
  if (!lastUserMessage) {
    throw new Error('No user message found to branch from');
  }

  return forkConversation(conversationId, lastUserMessage.id, branchName);
}

// ============================================================================
// Edit Message
// ============================================================================

/**
 * Edit a previous message and create a new branch from that point.
 * This preserves the original conversation while allowing edits.
 *
 * @param messageId - The message to edit
 * @param newContent - The new content for the message
 * @param options - Optional configuration
 * @returns Result with new branch ID
 */
export async function editMessage(
  messageId: string,
  newContent: string,
  options: {
    branchName?: string;
    regenerateResponse?: boolean;
  } = {}
): Promise<EditMessageResult> {
  try {
    // Get the message and its conversation
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        chat: true,
      },
    });

    if (!message) {
      return { success: false, error: 'Message not found' };
    }

    // Can only edit user messages
    if (message.role !== 'USER') {
      return { success: false, error: 'Can only edit user messages' };
    }

    // Fork the conversation at this message
    const newBranchId = await forkConversation(
      message.chatId,
      messageId,
      options.branchName ?? `${message.chat.title} (Edited)`
    );

    // Update the message in the new branch
    await prisma.message.updateMany({
      where: {
        chatId: newBranchId,
        role: 'USER',
        content: message.content,
      },
      data: {
        content: newContent,
        // Mark as edited
        metadata: {
          edited: true,
          originalContent: message.content,
          editedAt: new Date().toISOString(),
        },
      },
    });

    // Remove the assistant response after the edited message if requested
    if (options.regenerateResponse) {
      // The assistant message right after this one should be removed
      const messages = await prisma.message.findMany({
        where: { chatId: newBranchId },
        orderBy: { createdAt: 'asc' },
      });

      const editedMsgIndex = messages.findIndex(
        (m) => m.role === 'USER' && m.content === newContent
      );

      if (editedMsgIndex !== -1 && messages[editedMsgIndex + 1]?.role === 'ASSISTANT') {
        await prisma.message.delete({
          where: { id: messages[editedMsgIndex + 1].id },
        });
      }
    }

    return { success: true, newBranchId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to edit message',
    };
  }
}

/**
 * Delete messages from a point onwards (useful for regenerating)
 */
export async function truncateConversation(
  conversationId: string,
  fromMessageId: string
): Promise<void> {
  const messages = await prisma.message.findMany({
    where: { chatId: conversationId },
    orderBy: { createdAt: 'asc' },
  });

  const fromIndex = messages.findIndex((m) => m.id === fromMessageId);
  if (fromIndex === -1) {
    throw new Error('Message not found');
  }

  // Delete all messages from this point (including the specified message)
  const messagesToDelete = messages.slice(fromIndex);

  await prisma.message.deleteMany({
    where: {
      id: {
        in: messagesToDelete.map((m) => m.id),
      },
    },
  });
}

// ============================================================================
// Compare Branches
// ============================================================================

/**
 * Compare two conversation branches to see differences
 */
export async function compareBranches(
  branchAId: string,
  branchBId: string
): Promise<BranchComparison> {
  const [branchA, branchB] = await Promise.all([
    prisma.chat.findUnique({
      where: { id: branchAId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.chat.findUnique({
      where: { id: branchBId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
  ]);

  if (!branchA || !branchB) {
    throw new Error('One or both branches not found');
  }

  // Find divergence point
  let divergencePoint: string | null = null;
  const minLength = Math.min(branchA.messages.length, branchB.messages.length);

  for (let i = 0; i < minLength; i++) {
    const msgA = branchA.messages[i];
    const msgB = branchB.messages[i];

    if (msgA.content !== msgB.content || msgA.role !== msgB.role) {
      divergencePoint = msgA.id;
      break;
    }
  }

  // Identify differences
  const differences: Array<{
    type: 'added' | 'removed' | 'modified';
    messageId?: string;
    description: string;
  }> = [];

  // Compare messages
  const aMap = new Map(branchA.messages.map((m) => [m.id, m]));
  const bMap = new Map(branchB.messages.map((m) => [m.id, m]));

  // Check for modified or removed messages
  for (const [id, msgA] of aMap) {
    const msgB = bMap.get(id);
    if (!msgB) {
      differences.push({
        type: 'removed',
        messageId: id,
        description: `Message removed: "${msgA.content.slice(0, 50)}..."`,
      });
    } else if (msgA.content !== msgB.content) {
      differences.push({
        type: 'modified',
        messageId: id,
        description: `Message content differs`,
      });
    }
  }

  // Check for added messages in B
  for (const [id, msgB] of bMap) {
    if (!aMap.has(id)) {
      differences.push({
        type: 'added',
        messageId: id,
        description: `Message added: "${msgB.content.slice(0, 50)}..."`,
      });
    }
  }

  return {
    branchA: {
      id: branchAId,
      messages: branchA.messages as unknown as Message[],
    },
    branchB: {
      id: branchBId,
      messages: branchB.messages as unknown as Message[],
    },
    divergencePoint,
    differences,
  };
}

// ============================================================================
// List Branches
// ============================================================================

/**
 * List all branches of a conversation
 */
export async function listBranches(rootId: string): Promise<ConversationBranch[]> {
  // Get the root conversation
  const root = await prisma.chat.findUnique({
    where: { id: rootId },
  });

  if (!root) {
    throw new Error('Root conversation not found');
  }

  // Find all conversations that have this as their root or are the root itself
  const chats = await prisma.chat.findMany({
    where: {
      OR: [
        { id: rootId },
        {
          metadata: {
            path: ['rootId'],
            equals: rootId,
          },
        },
        {
          metadata: {
            path: ['parentId'],
            equals: rootId,
          },
        },
      ],
    },
    include: {
      _count: {
        select: { messages: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return chats.map((chat) => {
    const metadata = chat.metadata as {
      parentId?: string;
      rootId?: string;
      isBranch?: boolean;
      forkMessageId?: string;
    } | null;

    return {
      id: chat.id,
      parentId: metadata?.parentId ?? null,
      rootId: metadata?.rootId ?? rootId,
      name: chat.title,
      createdAt: chat.createdAt,
      messageCount: chat._count.messages,
    };
  });
}

/**
 * Get the conversation tree structure
 */
export async function getConversationTree(rootId: string): Promise<{
  root: string;
  branches: Array<{
    id: string;
    parentId: string | null;
    name: string;
  }>;
}> {
  const branches = await listBranches(rootId);

  return {
    root: rootId,
    branches: branches.map((b) => ({
      id: b.id,
      parentId: b.parentId,
      name: b.name,
    })),
  };
}

// ============================================================================
// Merge Branches
// ============================================================================

/**
 * Merge a branch back into its parent
 * (Creates a new message in parent with reference to branch)
 */
export async function mergeBranch(branchId: string, targetMessageId?: string): Promise<void> {
  const branch = await prisma.chat.findUnique({
    where: { id: branchId },
  });

  if (!branch) {
    throw new Error('Branch not found');
  }

  const metadata = branch.metadata as {
    parentId?: string;
    forkMessageId?: string;
  } | null;

  if (!metadata?.parentId) {
    throw new Error('Cannot merge: Branch has no parent');
  }

  // Create a reference message in the parent
  await prisma.message.create({
    data: {
      chatId: metadata.parentId,
      content: `[Branch merged: ${branch.title}](reference to branch ${branchId})`,
      role: 'SYSTEM',
      metadata: {
        type: 'branch_merge',
        branchId,
        targetMessageId,
      },
    },
  });
}

// ============================================================================
// End of Module
// ============================================================================
