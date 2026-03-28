/**
 * @openapi
 * /api/v1/chats:
 *   get:
 *     summary: List chats
 *     description: Get a list of chat conversations
 *     tags: [Chats]
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of chats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Chat'
 *   post:
 *     summary: Create chat
 *     description: Create a new chat conversation
 *     tags: [Chats]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Optional chat title
 *     responses:
 *       201:
 *         description: Chat created
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getServerSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const [chats, total] = await Promise.all([
    prisma.chat.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        _count: {
          select: { messages: true },
        },
      },
    }),
    prisma.chat.count({ where: { workspaceId: workspace.id } }),
  ]);

  return NextResponse.json({
    data: chats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      messageCount: chat._count.messages,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    })),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  });
}

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const title = body.title?.trim() || 'New Chat';

  const chat = await prisma.chat.create({
    data: {
      title,
      workspaceId: workspace.id,
      userId: session.user.id,
    },
  });

  return NextResponse.json(
    {
      data: {
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
    },
    { status: 201 }
  );
}
