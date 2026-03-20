/**
 * Notion Pages API Endpoint
 *
 * GET /api/integrations/notion/pages - List available Notion pages
 *
 * Returns a list of pages that the user has access to via their Notion integration.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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
