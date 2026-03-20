import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

// =============================================================================
// GET /api/admin/workspaces
// Get workspaces, optionally filtering out those with SSO
// =============================================================================

export async function GET(req: Request): Promise<Response> {
  try {
    // Verify admin access
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const withoutSso = searchParams.get('withoutSso') === 'true';

    const workspaces = await prisma.workspace.findMany({
      where: withoutSso
        ? {
            ssoEnabled: false,
          }
        : undefined,
      select: {
        id: true,
        name: true,
        slug: true,
        ssoEnabled: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error('Failed to fetch workspaces:', error);

    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to fetch workspaces' },
      { status: 500 }
    );
  }
}
