/**
 * @openapi
 * /api/v1/chats:
 *   get:
 *     summary: List chats
 *     description: Get a cursor-paginated list of chat conversations
 *     tags: [Chats]
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *       - name: cursor
 *         in: query
 *         schema:
 *           type: string
 *       - name: direction
 *         in: query
 *         schema:
 *           type: string
 *           enum: [forward, backward]
 *           default: forward
 *   post:
 *     summary: Create chat
 *     tags: [Chats]
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getServerSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import {
  buildCursorQuery,
  buildPaginationResult,
  createPaginationHeaders,
  parsePaginationParams,
  validatePaginationParams,
} from '@/lib/db/cursor-pagination';

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
  const paginationParams = parsePaginationParams(searchParams);
  const validation = validatePaginationParams(paginationParams);

  if (!validation.valid) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: validation.error } },
      { status: 400 }
    );
  }

  const {
    takeCount,
    where: cursorWhere,
    orderBy,
  } = buildCursorQuery<{ id: string; updatedAt: Date }>(paginationParams, {
    cursorField: 'updatedAt',
  });

  const where = {
    workspaceId: workspace.id,
    ...cursorWhere,
  };

  const [chats, total] = await Promise.all([
    prisma.chat.findMany({
      where,
      orderBy,
      take: takeCount,
      include: {
        _count: {
          select: { messages: true },
        },
      },
    }),
    prisma.chat.count({ where: { workspaceId: workspace.id } }),
  ]);

  const result = buildPaginationResult(chats, paginationParams, {
    cursorField: 'updatedAt',
    totalCount: total,
  });

  const headers = createPaginationHeaders(result);
  return NextResponse.json(
    {
      data: result.items.map((chat) => ({
        id: chat.id,
        title: chat.title,
        messageCount: chat._count.messages,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      })),
      pagination: result.pagination,
    },
    { headers }
  );
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
