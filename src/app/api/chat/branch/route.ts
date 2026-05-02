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

import { NextResponse } from 'next/server';
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

export async function POST(req: Request) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
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
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    // Validate body
    const { conversationId, messageId, branchName } = body as {
      conversationId?: string;
      messageId?: string;
      branchName?: string;
    };

    if (!conversationId || !messageId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'conversationId and messageId are required' },
        },
        { status: 400 }
      );
    }

    // Verify user has access to the conversation
    const chat = await prisma.chat.findFirst({
      where: {
        id: conversationId,
        OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
      },
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
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

    return NextResponse.json({
      success: true,
      data: {
        branchId: newBranchId,
        name: newBranch?.title || branchName || 'New Branch',
        parentId: conversationId,
        messageCount: newBranch?._count.messages || 0,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create branch';
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errorMessage },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - List branches for a conversation
// =============================================================================

export async function GET(req: Request) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
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
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_ID', message: 'conversationId or rootId is required' },
        },
        { status: 400 }
      );
    }

    // Verify user has access to the root conversation
    const rootChat = await prisma.chat.findFirst({
      where: {
        id: effectiveRootId,
        OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
      },
    });

    if (!rootChat) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Conversation not found' } },
        { status: 404 }
      );
    }

    // Get branches
    const branches = await listBranches(effectiveRootId);

    // Get tree structure if requested
    let tree = null;
    if (includeTree) {
      tree = await getConversationTree(effectiveRootId);
    }

    return NextResponse.json({
      success: true,
      data: {
        branches: branches.map((b) => ({
          ...b,
          createdAt: b.createdAt.toISOString(),
        })),
        tree,
        rootId: effectiveRootId,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to list branches';
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errorMessage },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Edit message and create new branch
// =============================================================================

export async function PATCH(req: Request) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
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
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
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
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'messageId and newContent are required' },
        },
        { status: 400 }
      );
    }

    // Verify user has access to the message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { chat: true },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Message not found' } },
        { status: 404 }
      );
    }

    const hasAccess =
      message.chat.userId === userId || (workspaceId && message.chat.workspaceId === workspaceId);

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Edit the message and create branch
    const result: EditMessageResult = await editMessage(messageId, newContent, {
      branchName,
      regenerateResponse,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'EDIT_FAILED', message: result.error || 'Failed to edit message' },
        },
        { status: 400 }
      );
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

    return NextResponse.json({
      success: true,
      data: {
        newBranchId: result.newBranchId,
        message: 'Message edited and new branch created',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to edit message';
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errorMessage },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Rename branch
// =============================================================================

export async function PUT(req: Request) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
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
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    // Validate body
    const { branchId, name } = body as {
      branchId?: string;
      name?: string;
    };

    if (!branchId || !name?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'branchId and name are required' },
        },
        { status: 400 }
      );
    }

    // Verify user has access to the branch
    const chat = await prisma.chat.findFirst({
      where: {
        id: branchId,
        OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
      },
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Branch not found' } },
        { status: 404 }
      );
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

    return NextResponse.json({
      success: true,
      data: {
        branchId,
        name: name.trim(),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to rename branch';
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errorMessage },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete branch
// =============================================================================

export async function DELETE(req: Request) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_ID', message: 'branchId is required' },
        },
        { status: 400 }
      );
    }

    // Verify user has access to the branch
    const chat = await prisma.chat.findFirst({
      where: {
        id: branchId,
        OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
      },
    });

    if (!chat) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Branch not found' } },
        { status: 404 }
      );
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

    return NextResponse.json({
      success: true,
      data: {
        branchId,
        deleted: true,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete branch';
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errorMessage },
      },
      { status: 500 }
    );
  }
}
