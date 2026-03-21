import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// =============================================================================
// PATCH /api/admin/sso/connections/[id]
// Update a SAML connection
// =============================================================================

export async function PATCH(req: Request, { params }: RouteParams): Promise<Response> {
  try {
    // Verify admin access
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

    // Update workspace SSO settings if connection is disabled
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

    return NextResponse.json({ connection });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to update SSO connection' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/admin/sso/connections/[id]
// Delete a SAML connection
// =============================================================================

export async function DELETE(_req: Request, { params }: RouteParams): Promise<Response> {
  try {
    // Verify admin access
    await requireAdmin();

    const { id } = await params;

    // Get the connection to find the workspace ID
    const connection = await prisma.samlConnection.findUnique({
      where: { id },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Not Found', message: 'SSO connection not found' },
        { status: 404 }
      );
    }

    // Delete the connection
    await prisma.samlConnection.delete({
      where: { id },
    });

    // Update workspace SSO settings
    await prisma.workspace.update({
      where: { id: connection.workspaceId },
      data: {
        ssoEnabled: false,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Failed to delete SSO connection' },
      { status: 500 }
    );
  }
}
