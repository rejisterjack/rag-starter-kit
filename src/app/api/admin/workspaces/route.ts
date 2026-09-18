import { apiError, apiSuccess } from '@/lib/api-response';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

// =============================================================================
// GET /api/admin/workspaces
// Get workspaces, optionally filtering out those with SSO
// =============================================================================

export async function GET(req: Request): Promise<Response> {
  try {
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

    return apiSuccess({ workspaces });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return apiError('FORBIDDEN', 'Admin access required', 403);
    }

    return apiError('INTERNAL_ERROR', 'Failed to fetch workspaces', 500);
  }
}
