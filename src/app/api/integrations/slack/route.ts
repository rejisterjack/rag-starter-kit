/**
 * Slack Integration Status API
 *
 * GET /api/integrations/slack - Get Slack integration status
 * DELETE /api/integrations/slack - Disconnect Slack integration
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/integrations/slack
 * Get the current user's Slack integration status
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const integration = await prisma.integrationAccount.findFirst({
      where: {
        provider: 'slack',
        userId: session.user.id,
      },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        scope: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!integration) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          integration: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        integration: {
          id: integration.id,
          provider: integration.provider,
          providerAccountId: integration.providerAccountId,
          scope: integration.scope,
          createdAt: integration.createdAt.toISOString(),
          updatedAt: integration.updatedAt.toISOString(),
        },
      },
    });
  } catch (error) {
    logger.error('Error getting Slack integration status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get integration status',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/slack
 * Disconnect the Slack integration for the current user
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const integration = await prisma.integrationAccount.findFirst({
      where: {
        provider: 'slack',
        userId: session.user.id,
      },
    });

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Slack integration not found',
          },
        },
        { status: 404 }
      );
    }

    await prisma.integrationAccount.delete({
      where: {
        id: integration.id,
      },
    });

    logger.info('Slack integration disconnected', {
      userId: session.user.id,
      integrationId: integration.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Slack integration disconnected successfully',
      },
    });
  } catch (error) {
    logger.error('Error disconnecting Slack integration', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to disconnect integration',
        },
      },
      { status: 500 }
    );
  }
}
