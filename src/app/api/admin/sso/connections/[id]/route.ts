import { apiError, apiSuccess } from '@/lib/api-response';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams): Promise<Response> {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();
    const { enabled } = body;

    const connection = await prisma.samlConnection.update({
      where: { id },
      data: {
        enabled,
      },
    });

    if (enabled === false) {
      await prisma.workspace.update({
        where: { id: connection.workspaceId },
        data: {
          ssoEnabled: false,
        },
      });
    } else if (enabled === true) {
      await prisma.workspace.update({
        where: { id: connection.workspaceId },
        data: {
          ssoEnabled: true,
        },
      });
    }

    return apiSuccess({ connection });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return apiError('FORBIDDEN', 'Admin access required', 403);
    }

    return apiError('INTERNAL_ERROR', 'Failed to update SSO connection', 500);
  }
}

export async function DELETE(_req: Request, { params }: RouteParams): Promise<Response> {
  try {
    await requireAdmin();

    const { id } = await params;

    const connection = await prisma.samlConnection.findUnique({
      where: { id },
    });

    if (!connection) {
      return apiError('NOT_FOUND', 'SSO connection not found', 404);
    }

    await prisma.samlConnection.delete({
      where: { id },
    });

    await prisma.workspace.update({
      where: { id: connection.workspaceId },
      data: {
        ssoEnabled: false,
      },
    });

    return apiSuccess({});
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return apiError('FORBIDDEN', 'Admin access required', 403);
    }

    return apiError('INTERNAL_ERROR', 'Failed to delete SSO connection', 500);
  }
}
