import { Elysia } from 'elysia';
import { prisma } from '@/lib/db';
import { requireAuth } from '../plugins/auth';

export const workspacesRoutes = new Elysia({
  name: 'elysia/workspaces',
  prefix: '/workspaces',
})
  .use(requireAuth)
  .get('/', async ({ session }) => {
    const workspaces = await prisma.workspace.findMany({
      where: { members: { some: { userId: session?.userId } } },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { documents: true, members: true } } },
    });

    return {
      data: workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        description: ws.description,
        documentCount: ws._count.documents,
        memberCount: ws._count.members,
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt,
      })),
    };
  });
