/**
 * Conversation Branch API Routes
 *
 * Handles:
 * - POST /api/chat/branch - Create new branch (fork conversation)
 * - GET /api/chat/branch?conversationId=x - List branches
 * - PATCH /api/chat/branch - Edit message and regenerate
 * - PUT /api/chat/branch - Rename branch
 * - DELETE /api/chat/branch?branchId=x - Delete branch
 */

import type { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-response';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  type EditMessageResult,
  editMessage,
  forkConversation,
  getConversationTree,
  listBranches,
} from '@/lib/rag/conversation-branch';
// =============================================================================
// POST - Create new branch
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in branch creation request', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return apiError('INVALID_BODY', 'Invalid JSON body', 400);
    }

    // Validate body
    const { conversationId, messageId, branchName } = body as {
      conversationId?: string;
      messageId?: string;
      branchName?: string;
    };

    if (!conversationId || !messageId) {
      return apiError('MISSING_FIELDS', 'conversationId and messageId are required', 400);
    }

    // Verify user has access to the conversation
    const chat = await prisma.chat.findFirst({
      where: {
        id: conversationId,
        OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
      },
    });

    if (!chat) {
      return apiError('NOT_FOUND', 'Conversation not found', 404);
    }

    // Create the branch
    const newBranchId = await forkConversation(conversationId, messageId, branchName);

    // Get the new branch details
    const newBranch = await prisma.chat.findUnique({
      where: { id: newBranchId },
      include: { _count: { select: { messages: true } } },
    });

    // Log the action
    await logAuditEvent({
      event: AuditEvent.CHAT_UPDATED,
      userId,
      workspaceId,
      severity: 'INFO',
      metadata: {
        action: 'fork_conversation',
        chatId: newBranchId,
        parentId: conversationId,
        forkMessageId: messageId,
        isBranch: true,
      },
    });

    return apiSuccess({
      branchId: newBranchId,
      name: newBranch?.title || branchName || 'New Branch',
      parentId: conversationId,
      messageCount: newBranch?._count.messages || 0,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create branch';
    return apiError('INTERNAL_ERROR', errorMessage, 500);
  }
}

// =============================================================================
// GET - List branches for a conversation
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');
    const rootId = searchParams.get('rootId');
    const includeTree = searchParams.get('tree') === 'true';

    const effectiveRootId = conversationId || rootId;

    if (!effectiveRootId) {
      return apiError('MISSING_ID', 'conversationId or rootId is required', 400);
    }

    // Verify user has access to the root conversation
    const rootChat = await prisma.chat.findFirst({
      where: {
        id: effectiveRootId,
        OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
      },
    });

    if (!rootChat) {
      return apiError('NOT_FOUND', 'Conversation not found', 404);
    }

    // Get branches
    const branches = await listBranches(effectiveRootId);

    // Get tree structure if requested
    let tree = null;
    if (includeTree) {
      tree = await getConversationTree(effectiveRootId);
    }

    return apiSuccess({
      branches: branches.map((b) => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
      })),
      tree,
      rootId: effectiveRootId,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to list branches';
    return apiError('INTERNAL_ERROR', errorMessage, 500);
  }
}

// =============================================================================
// PATCH - Edit message and create new branch
// =============================================================================

export async function PATCH(req: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in message edit request', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return apiError('INVALID_BODY', 'Invalid JSON body', 400);
    }

    // Validate body
    const {
      messageId,
      newContent,
      regenerateResponse = true,
      branchName,
    } = body as {
      messageId?: string;
      newContent?: string;
      regenerateResponse?: boolean;
      branchName?: string;
    };

    if (!messageId || !newContent) {
      return apiError('MISSING_FIELDS', 'messageId and newContent are required', 400);
    }

    // Verify user has access to the message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { chat: true },
    });

    if (!message) {
      return apiError('NOT_FOUND', 'Message not found', 404);
    }

    const hasAccess =
      message.chat.userId === userId || (workspaceId && message.chat.workspaceId === workspaceId);

    if (!hasAccess) {
      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Edit the message and create branch
    const result: EditMessageResult = await editMessage(messageId, newContent, {
      branchName,
      regenerateResponse,
    });

    if (!result.success) {
      return apiError('EDIT_FAILED', result.error || 'Failed to edit message', 400);
    }

    // Log the action
    await logAuditEvent({
      event: AuditEvent.CHAT_UPDATED,
      userId,
      workspaceId,
      metadata: {
        action: 'edit_message_and_fork',
        messageId,
        newBranchId: result.newBranchId,
        regenerateResponse,
      },
      severity: 'INFO',
    });

    return apiSuccess({
      newBranchId: result.newBranchId,
      message: 'Message edited and new branch created',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to edit message';
    return apiError('INTERNAL_ERROR', errorMessage, 500);
  }
}

// =============================================================================
// PUT - Rename branch
// =============================================================================

export async function PUT(req: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Invalid JSON body in branch rename request', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return apiError('INVALID_BODY', 'Invalid JSON body', 400);
    }

    // Validate body
    const { branchId, name } = body as {
      branchId?: string;
      name?: string;
    };

    if (!branchId || !name?.trim()) {
      return apiError('MISSING_FIELDS', 'branchId and name are required', 400);
    }

    // Verify user has access to the branch
    const chat = await prisma.chat.findFirst({
      where: {
        id: branchId,
        OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
      },
    });

    if (!chat) {
      return apiError('NOT_FOUND', 'Branch not found', 404);
    }

    // Update the branch name
    await prisma.chat.update({
      where: { id: branchId },
      data: { title: name.trim() },
    });

    // Log the action
    await logAuditEvent({
      event: AuditEvent.CHAT_UPDATED,
      userId,
      workspaceId,
      metadata: {
        chatId: branchId,
        action: 'rename',
        newName: name.trim(),
      },
    });

    return apiSuccess({
      branchId,
      name: name.trim(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to rename branch';
    return apiError('INTERNAL_ERROR', errorMessage, 500);
  }
}

// =============================================================================
// DELETE - Delete branch
// =============================================================================

export async function DELETE(req: NextRequest) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return apiError('MISSING_ID', 'branchId is required', 400);
    }

    // Verify user has access to the branch
    const chat = await prisma.chat.findFirst({
      where: {
        id: branchId,
        OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
      },
    });

    if (!chat) {
      return apiError('NOT_FOUND', 'Branch not found', 404);
    }

    // Check if trying to delete root conversation (not a branch)
    const metadata = chat.metadata as { isBranch?: boolean; rootId?: string } | null;
    await logAuditEvent({
      event: AuditEvent.CHAT_DELETED,
      userId,
      workspaceId,
      metadata: {
        chatId: branchId,
        isRoot: !metadata?.isBranch,
        isBranch: metadata?.isBranch ?? false,
      },
      severity: 'WARNING',
    });

    // Delete the branch (cascade will handle messages)
    await prisma.chat.delete({
      where: { id: branchId },
    });

    return apiSuccess({
      branchId,
      deleted: true,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete branch';
    return apiError('INTERNAL_ERROR', errorMessage, 500);
  }
}
