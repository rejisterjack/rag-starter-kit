import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import {
  createWorkspace,
  getUserWorkspaces,
} from '@/lib/workspace/workspace';
import { validateCreateWorkspaceInput } from '@/lib/security/input-validator';
import { checkApiRateLimit, getRateLimitIdentifier } from '@/lib/security/rate-limiter';

/**
 * GET /api/workspaces
 * Get all workspaces for the current user
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const workspaces = await getUserWorkspaces(session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        workspaces: workspaces.map((w) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          description: w.description,
          avatar: w.avatar,
          plan: w.plan,
          role: w.members.find((m) => m.userId === session.user.id)?.role || 'MEMBER',
          memberCount: w.members.length,
          documentCount: w._count.documents,
          chatCount: w._count.chats,
          createdAt: w.createdAt.toISOString(),
        })),
        currentWorkspaceId: session.user.workspaceId,
      },
    });
  } catch (error) {
    console.error('Get workspaces error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get workspaces' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspaces
 * Create a new workspace
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId: session.user.id });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'workspace', {
      userId: session.user.id,
      endpoint: '/api/workspaces',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMIT', message: 'Rate limit exceeded' } },
        { status: 429 }
      );
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    let validatedInput;
    try {
      validatedInput = validateCreateWorkspaceInput(body);
    } catch (error) {
      if (error instanceof Error) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: error.message } },
          { status: 400 }
        );
      }
      throw error;
    }

    // Create workspace
    const workspace = await createWorkspace(session.user.id, validatedInput);

    return NextResponse.json(
      {
        success: true,
        data: {
          workspace: {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            description: workspace.description,
            plan: workspace.plan,
            createdAt: workspace.createdAt.toISOString(),
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create workspace error:', error);
    
    if (error instanceof Error && error.message === 'Workspace slug already taken') {
      return NextResponse.json(
        { error: { code: 'SLUG_TAKEN', message: 'Workspace slug is already taken' } },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create workspace' } },
      { status: 500 }
    );
  }
}
