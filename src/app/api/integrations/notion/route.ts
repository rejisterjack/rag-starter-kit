/**
 * Notion Integration API Routes
 *
 * GET /api/integrations/notion - Get integration status
 * DELETE /api/integrations/notion - Disconnect Notion integration
 * POST /api/integrations/notion - Import a Notion page
 */

import { type NextRequest, NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NotionIntegration } from '@/lib/integrations/notion';
import { deleteNotionIntegration, getNotionIntegration } from '@/lib/integrations/notion-oauth';
import { logger } from '@/lib/logger';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// =============================================================================
// GET /api/integrations/notion - Get integration status
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || session.user.workspaceId;

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Workspace ID is required' } },
        { status: 400 }
      );
    }

    // Check workspace permission
    const hasAccess = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.READ_DOCUMENTS
    );
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Get integration status
    const integration = await getNotionIntegration(session.user.id, workspaceId);

    if (!integration) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        workspaceId: integration.notionWorkspaceId,
        workspaceName: integration.notionWorkspaceName,
        createdAt: integration.createdAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get Notion integration status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/integrations/notion - Disconnect Notion integration
// =============================================================================

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspaceId') || session.user.workspaceId;

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Workspace ID is required' } },
        { status: 400 }
      );
    }

    // Check workspace permission
    const hasAccess = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_WORKSPACE
    );
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Get integration before deletion for logging
    const integration = await getNotionIntegration(session.user.id, workspaceId);

    if (!integration) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Notion integration not found' } },
        { status: 404 }
      );
    }

    // Delete integration
    await deleteNotionIntegration(session.user.id, workspaceId);

    // Log disconnection
    await logAuditEvent({
      event: AuditEvent.WORKSPACE_SETTINGS_CHANGED,
      userId: session.user.id,
      workspaceId,
      metadata: {
        action: 'notion_disconnect',
        notionWorkspaceId: integration.notionWorkspaceId,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Notion integration disconnected successfully',
      },
    });
  } catch (error) {
    logger.error('Failed to disconnect Notion integration', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/integrations/notion - Import a Notion page
// =============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Parse request body
    let body: { pageId?: string; workspaceId?: string };
    try {
      body = await req.json();
    } catch (error: unknown) {
      logger.debug('Failed to parse request body for Notion page import', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { pageId, workspaceId = session.user.workspaceId } = body;

    if (!pageId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Page ID is required' } },
        { status: 400 }
      );
    }

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Workspace ID is required' } },
        { status: 400 }
      );
    }

    // Check workspace permission
    const hasAccess = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.WRITE_DOCUMENTS
    );
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Get Notion integration
    const integration = await getNotionIntegration(session.user.id, workspaceId);

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Notion integration not connected' },
        },
        { status: 400 }
      );
    }

    // Initialize Notion client
    const notion = new NotionIntegration(integration.accessToken);

    // Import the page
    const pageData = await notion.importPage(pageId);

    // Create document in database
    const document = await prisma.document.create({
      data: {
        name: pageData.title,
        contentType: 'NOTION',
        size: Buffer.byteLength(pageData.content, 'utf8'),
        content: pageData.content,
        sourceUrl: pageData.url,
        sourceType: 'notion',
        status: 'PENDING',
        userId: session.user.id,
        workspaceId,
        metadata: {
          notionPageId: pageId,
          importedAt: new Date().toISOString(),
          source: 'notion',
        },
      },
    });

    // Log import
    await logAuditEvent({
      event: AuditEvent.DOCUMENT_UPLOADED,
      userId: session.user.id,
      workspaceId,
      metadata: {
        documentId: document.id,
        source: 'notion',
        notionPageId: pageId,
        title: pageData.title,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          document: {
            id: document.id,
            name: document.name,
            status: 'pending',
            createdAt: document.createdAt.toISOString(),
          },
          notionPage: {
            id: pageId,
            title: pageData.title,
            url: pageData.url,
          },
          processingTimeMs: Date.now() - startTime,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Failed to import Notion page', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'IMPORT_FAILED',
          message: error instanceof Error ? error.message : 'Failed to import Notion page',
        },
      },
      { status: 500 }
    );
  }
}
