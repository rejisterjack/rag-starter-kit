/**
 * Google Drive Integration API Routes
 *
 * GET    /api/integrations/google-drive - Initiate Google OAuth flow
 * POST   /api/integrations/google-drive - Sync selected files
 * DELETE /api/integrations/google-drive - Disconnect Google Drive integration
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// =============================================================================
// Configuration
// =============================================================================

const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/integrations/google-drive/oauth/callback`,
  };
}

// =============================================================================
// GET /api/integrations/google-drive - Initiate Google OAuth flow
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

    const config = getGoogleOAuthConfig();
    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_CONFIGURED',
            message:
              'Google Drive OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
          },
        },
        { status: 503 }
      );
    }

    // Generate state parameter
    const stateData = {
      userId: session.user.id,
      workspaceId,
      nonce: crypto.randomUUID(),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Store state in cookie
    const cookieStore = await cookies();
    cookieStore.set('google_drive_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    // Build Google authorization URL
    const authUrl = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', GOOGLE_DRIVE_SCOPES.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state);

    logger.info('Starting Google Drive OAuth flow', {
      userId: session.user.id,
      workspaceId,
    });

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    logger.error('Failed to start Google Drive OAuth flow', {
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
// POST /api/integrations/google-drive - Sync selected files
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

    let body: {
      files?: Array<{ id: string; name: string; mimeType: string; webViewLink: string }>;
      workspaceId?: string;
    };
    try {
      body = await req.json();
    } catch (_error: unknown) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { files, workspaceId = session.user.workspaceId } = body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Files array is required' } },
        { status: 400 }
      );
    }

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Workspace ID is required' } },
        { status: 400 }
      );
    }

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

    // Get Google Drive integration
    const integration = await prisma.integrationAccount.findFirst({
      where: {
        provider: 'google-drive',
        userId: session.user.id,
        workspaceId,
      },
    });

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'Google Drive integration not connected' },
        },
        { status: 400 }
      );
    }

    const { getFileContent } = await import('@/lib/integrations/google-drive');
    const { inngest } = await import('@/lib/inngest/client');

    const syncedDocuments: Array<{
      id: string;
      name: string;
    }> = [];

    for (const file of files) {
      try {
        // Fetch file content
        const content = await getFileContent(integration.accessToken, {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          modifiedTime: new Date().toISOString(),
          webViewLink: file.webViewLink,
        });

        // Determine content type
        let contentType = 'TXT';
        if (file.mimeType === 'text/markdown' || file.mimeType === 'text/x-markdown') {
          contentType = 'MD';
        } else if (
          file.mimeType === 'application/vnd.google-apps.document' ||
          file.mimeType === 'application/vnd.google-apps.spreadsheet' ||
          file.mimeType === 'application/vnd.google-apps.presentation'
        ) {
          contentType = 'MD';
        }

        const document = await prisma.document.create({
          data: {
            name: file.name,
            contentType,
            size: Buffer.byteLength(content, 'utf8'),
            content,
            sourceUrl: file.webViewLink,
            sourceType: 'google-drive',
            status: 'PENDING',
            userId: session.user.id,
            workspaceId,
            metadata: {
              googleDriveFileId: file.id,
              googleDriveMimeType: file.mimeType,
              importedAt: new Date().toISOString(),
              source: 'google-drive',
            },
          },
        });

        // Trigger ingestion
        await inngest.send({
          name: 'document/ingest',
          data: { documentId: document.id, userId: session.user.id },
        });

        syncedDocuments.push({
          id: document.id,
          name: document.name,
        });
      } catch (fileError) {
        logger.error('Failed to sync Google Drive file', {
          fileId: file.id,
          fileName: file.name,
          error: fileError instanceof Error ? fileError.message : 'Unknown error',
        });
      }
    }

    // Log sync event
    await logAuditEvent({
      event: AuditEvent.DOCUMENT_UPLOADED,
      userId: session.user.id,
      workspaceId,
      metadata: {
        source: 'google-drive',
        filesSynced: syncedDocuments.length,
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
    logger.error('Failed to sync Google Drive files', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SYNC_FAILED',
          message: error instanceof Error ? error.message : 'Failed to sync Google Drive files',
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/integrations/google-drive - Disconnect Google Drive integration
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

    const existing = await prisma.integrationAccount.findFirst({
      where: { provider: 'google-drive', userId: session.user.id, workspaceId },
    });

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Google Drive integration not found' },
        },
        { status: 404 }
      );
    }

    await prisma.integrationAccount.delete({ where: { id: existing.id } });

    await logAuditEvent({
      event: AuditEvent.WORKSPACE_SETTINGS_CHANGED,
      userId: session.user.id,
      workspaceId,
      metadata: { action: 'google_drive_disconnect' },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Google Drive integration disconnected successfully' },
    });
  } catch (error) {
    logger.error('Failed to disconnect Google Drive integration', {
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
