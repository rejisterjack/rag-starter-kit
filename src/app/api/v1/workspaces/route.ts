/**
 * @openapi
 * /api/v1/workspaces:
 *   get:
 *     summary: List workspaces
 *     description: Get workspaces the user has access to
 *     tags: [Workspaces]
 *     responses:
 *       200:
 *         description: List of workspaces
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Workspace'
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const workspaces = await prisma.workspace.findMany({
    where: {
      members: {
        some: { userId: session.user.id },
      },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: { documents: true, members: true },
      },
    },
  });

  return NextResponse.json({
    data: workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      description: ws.description,
      documentCount: ws._count.documents,
      memberCount: ws._count.members,
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
    })),
  });
}
