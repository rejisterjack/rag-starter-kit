/**
 * GitHub Integration API Routes
 *
 * GET  /api/integrations/github        - Initiate GitHub OAuth flow
 * POST /api/integrations/github        - Sync selected repositories
 * GET  /api/integrations/github/status  - Get integration status
 * DELETE /api/integrations/github       - Disconnect GitHub integration
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

const GITHUB_OAUTH_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_SCOPES = ['repo', 'read:org'];

function getGitHubOAuthConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${appUrl}/api/integrations/github/oauth/callback`,
  };
}

// =============================================================================
// GET /api/integrations/github - Initiate GitHub OAuth flow
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

    const config = getGitHubOAuthConfig();
    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_CONFIGURED',
            message:
              'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
          },
        },
        { status: 503 }
      );
    }

    // Generate state parameter with user and workspace info
    const stateData = {
      userId: session.user.id,
      workspaceId,
      nonce: crypto.randomUUID(),
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Store state in cookie for CSRF validation
    const cookieStore = await cookies();
    cookieStore.set('github_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    // Build GitHub authorization URL
    const authUrl = new URL(GITHUB_OAUTH_AUTHORIZE_URL);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('scope', GITHUB_SCOPES.join(' '));
    authUrl.searchParams.set('state', state);

    logger.info('Starting GitHub OAuth flow', {
      userId: session.user.id,
      workspaceId,
    });

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    logger.error('Failed to start GitHub OAuth flow', {
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
// POST /api/integrations/github - Sync selected repositories
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

    let body: { repos?: Array<{ owner: string; repo: string }>; workspaceId?: string };
    try {
      body = await req.json();
    } catch (_error: unknown) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    const { repos, workspaceId = session.user.workspaceId } = body;

    if (!repos || !Array.isArray(repos) || repos.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Repos array is required' } },
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

    // Get GitHub integration
    const integration = await prisma.integrationAccount.findFirst({
      where: {
        provider: 'github',
        userId: session.user.id,
        workspaceId,
      },
    });

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_CONNECTED', message: 'GitHub integration not connected' },
        },
        { status: 400 }
      );
    }

    const { getRepoReadme, getRepoDocs } = await import('@/lib/integrations/github');
    const { inngest } = await import('@/lib/inngest/client');

    const syncedDocuments: Array<{
      id: string;
      name: string;
      source: string;
    }> = [];

    for (const { owner, repo } of repos) {
      try {
        // Fetch README
        const readme = await getRepoReadme(integration.accessToken, owner, repo);

        if (readme) {
          const document = await prisma.document.create({
            data: {
              name: `${repo} - README.md`,
              contentType: 'MD',
              size: Buffer.byteLength(readme, 'utf8'),
              content: readme,
              sourceUrl: `https://github.com/${owner}/${repo}`,
              sourceType: 'github',
              status: 'PENDING',
              userId: session.user.id,
              workspaceId,
              metadata: {
                githubOwner: owner,
                githubRepo: repo,
                githubFileType: 'readme',
                importedAt: new Date().toISOString(),
                source: 'github',
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
            source: 'readme',
          });
        }

        // Fetch docs directory files
        const docFiles = await getRepoDocs(integration.accessToken, owner, repo);

        for (const file of docFiles) {
          const doc = await prisma.document.create({
            data: {
              name: `${repo} - ${file.path}`,
              contentType: 'MD',
              size: Buffer.byteLength(file.content, 'utf8'),
              content: file.content,
              sourceUrl: `https://github.com/${owner}/${repo}/blob/main/${file.path}`,
              sourceType: 'github',
              status: 'PENDING',
              userId: session.user.id,
              workspaceId,
              metadata: {
                githubOwner: owner,
                githubRepo: repo,
                githubFilePath: file.path,
                githubFileType: 'docs',
                importedAt: new Date().toISOString(),
                source: 'github',
              },
            },
          });

          await inngest.send({
            name: 'document/ingest',
            data: { documentId: doc.id, userId: session.user.id },
          });

          syncedDocuments.push({
            id: doc.id,
            name: doc.name,
            source: 'docs',
          });
        }

        // Log import
        await logAuditEvent({
          event: AuditEvent.DOCUMENT_UPLOADED,
          userId: session.user.id,
          workspaceId,
          metadata: {
            source: 'github',
            owner,
            repo,
            filesSynced: 1 + docFiles.length,
          },
        });
      } catch (repoError) {
        logger.error('Failed to sync GitHub repo', {
          owner,
          repo,
          error: repoError instanceof Error ? repoError.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        documents: syncedDocuments,
        total: syncedDocuments.length,
        processingTimeMs: Date.now() - startTime,
      },
    });
  } catch (error) {
    logger.error('Failed to sync GitHub repos', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SYNC_FAILED',
          message: error instanceof Error ? error.message : 'Failed to sync GitHub repos',
        },
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/integrations/github - Disconnect GitHub integration
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
      where: { provider: 'github', userId: session.user.id, workspaceId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'GitHub integration not found' } },
        { status: 404 }
      );
    }

    await prisma.integrationAccount.delete({ where: { id: existing.id } });

    await logAuditEvent({
      event: AuditEvent.WORKSPACE_SETTINGS_CHANGED,
      userId: session.user.id,
      workspaceId,
      metadata: { action: 'github_disconnect' },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'GitHub integration disconnected successfully' },
    });
  } catch (error) {
    logger.error('Failed to disconnect GitHub integration', {
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
