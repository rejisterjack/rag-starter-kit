/**
 * Notion Pages API Endpoint
 *
 * GET  /api/integrations/notion/pages - List available Notion pages
 * POST /api/integrations/notion/pages - Sync selected pages (trigger ingestion)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NotionIntegration } from '@/lib/integrations/notion';
import { getNotionIntegration } from '@/lib/integrations/notion-oauth';
import { logger } from '@/lib/logger';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// =============================================================================
// GET /api/integrations/notion/pages - List available pages
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

    // Get workspace ID from query params
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

    // Fetch pages from Notion
    const pages = await notion.listPages();

    return NextResponse.json({
      success: true,
      data: {
        pages: pages.map((page) => ({
          id: page.id,
          title: page.title,
          url: page.url,
          lastEdited: page.lastEdited,
        })),
        total: pages.length,
      },
    });
  } catch (error) {
    logger.error('Failed to list Notion pages', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Handle specific Notion API errors
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized') || error.message.includes('401')) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'TOKEN_INVALID',
              message: 'Notion authorization expired. Please reconnect your integration.',
            },
          },
          { status: 401 }
        );
      }
    }

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
// POST /api/integrations/notion/pages - Sync selected pages
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

    let body: { pageIds?: string[]; workspaceId?: string };
    try {
      body = await req.json();
    } catch (_error: unknown) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { pageIds, workspaceId = session.user.workspaceId } = body;

    if (!pageIds || !Array.isArray(pageIds) || pageIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Page IDs array is required' } },
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
    const { inngest } = await import('@/lib/inngest/client');

    const syncedDocuments: Array<{
      id: string;
      name: string;
      notionPageId: string;
    }> = [];

    for (const pageId of pageIds) {
      try {
        // Import page content
        const pageData = await notion.importPage(pageId);

        // Create document record
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

        // Trigger Inngest ingestion
        await inngest.send({
          name: 'document/ingest',
          data: { documentId: document.id, userId: session.user.id },
        });

        syncedDocuments.push({
          id: document.id,
          name: document.name,
          notionPageId: pageId,
        });
      } catch (pageError) {
        logger.error('Failed to sync Notion page', {
          pageId,
          error: pageError instanceof Error ? pageError.message : 'Unknown error',
        });
      }
    }

    // Log bulk import
    await logAuditEvent({
      event: AuditEvent.DOCUMENT_UPLOADED,
      userId: session.user.id,
      workspaceId,
      metadata: {
        source: 'notion',
        pagesSynced: syncedDocuments.length,
        pageIds,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        documents: syncedDocuments,
        total: syncedDocuments.length,
        processingTimeMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    logger.error('Failed to sync Notion pages', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SYNC_FAILED',
          message: error instanceof Error ? error.message : 'Failed to sync Notion pages',
        },
      },
      { status: 500 }
    );
  }
}
