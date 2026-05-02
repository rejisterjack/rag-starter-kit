/**
 * GitHub Repos API Endpoint
 *
 * GET  /api/integrations/github/repos - List user's repositories
 * POST /api/integrations/github/repos - Sync selected repos (fetch README + docs, trigger ingestion)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { type GitHubRepo, listUserRepos } from '@/lib/integrations/github';
import { logger } from '@/lib/logger';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

// =============================================================================
// GET /api/integrations/github/repos - List user's repositories
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
      Permission.READ_DOCUMENTS
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

    // Fetch repos from GitHub
    const repos = await listUserRepos(integration.accessToken);

    return NextResponse.json({
      success: true,
      data: {
        repos: repos.map((repo: GitHubRepo) => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          private: repo.private,
          updatedAt: repo.updated_at,
        })),
        total: repos.length,
      },
    });
  } catch (error) {
    logger.error('Failed to list GitHub repos', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (
      error instanceof Error &&
      (error.message.includes('401') || error.message.includes('Unauthorized'))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOKEN_INVALID',
            message: 'GitHub authorization expired. Please reconnect your integration.',
          },
        },
        { status: 401 }
      );
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
// POST /api/integrations/github/repos - Sync selected repos
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
      repos: Array<{ owner: string; repo: string }>;
      includeReadme?: boolean;
      includeDocs?: boolean;
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

    const {
      repos,
      includeReadme = true,
      includeDocs = true,
      workspaceId = session.user.workspaceId,
    } = body;

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
      repo: string;
      source: string;
    }> = [];

    for (const { owner, repo } of repos) {
      try {
        // Fetch README if requested
        if (includeReadme) {
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

            await inngest.send({
              name: 'document/ingest',
              data: { documentId: document.id, userId: session.user.id },
            });

            syncedDocuments.push({
              id: document.id,
              name: document.name,
              repo,
              source: 'readme',
            });
          }
        }

        // Fetch docs directory files if requested
        if (includeDocs) {
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
              repo,
              source: `docs/${file.path}`,
            });
          }
        }
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
