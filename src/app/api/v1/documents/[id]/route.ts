/**
 * @openapi
 * /api/v1/documents/{id}:
 *   get:
 *     summary: Get document details
 *     description: Retrieve detailed information about a specific document
 *     tags: [Documents]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document details
 *       404:
 *         description: Document not found
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getServerSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const workspace = await getServerSession();
  if (!workspace) {
    return NextResponse.json(
      { error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } },
      { status: 404 }
    );
  }

  const { id } = await context.params;

  const document = await prisma.document.findFirst({
    where: {
      id,
      workspaceId: workspace.id,
    },
    include: {
      chunks: {
        orderBy: { index: 'asc' },
        select: {
          id: true,
          index: true,
          content: true,
          page: true,
          section: true,
        },
      },
    },
  });

  if (!document) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Document not found' } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      ...document,
      size: Number(document.size),
    },
  });
}

/**
 * @openapi
 *   delete:
 *     summary: Delete document
 *     description: Permanently delete a document and all its chunks
 *     tags: [Documents]
 *     responses:
 *       200:
 *         description: Document deleted
 *       404:
 *         description: Document not found
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const workspace = await getServerSession();
  if (!workspace) {
    return NextResponse.json(
      { error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } },
      { status: 404 }
    );
  }

  const { id } = await context.params;

  const document = await prisma.document.findFirst({
    where: {
      id,
      workspaceId: workspace.id,
    },
  });

  if (!document) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Document not found' } },
      { status: 404 }
    );
  }

  await prisma.document.delete({
    where: { id },
  });

  return NextResponse.json({
    data: { message: 'Document deleted successfully' },
  });
}
