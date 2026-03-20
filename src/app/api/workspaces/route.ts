import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { validateCreateWorkspaceInput } from '@/lib/security/input-validator';
import { checkApiRateLimit, getRateLimitIdentifier } from '@/lib/security/rate-limiter';
import { createWorkspace, getUserWorkspaces } from '@/lib/workspace/workspace';

/**
 * GET /api/workspaces
 * Get all workspaces for the current user with pagination
 * Query params: page (default: 1), limit (default: 20, max: 100)
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Parse pagination params
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    const allWorkspaces = await getUserWorkspaces(session.user.id);

    // Calculate pagination
    const total = allWorkspaces.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, total);
    const workspaces = allWorkspaces.slice(startIndex, endIndex);

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
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (_error) {
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

    let validatedInput: ReturnType<typeof validateCreateWorkspaceInput>;
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
