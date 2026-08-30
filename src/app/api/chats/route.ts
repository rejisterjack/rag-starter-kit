import { apiError, apiSuccess } from '@/lib/api-response';
/**
 * @openapi
 * /api/chats:
 *   get:
 *     summary: List chats
 *     description: Get a cursor-paginated list of chat conversations
 *     tags: [Chats]
 *   post:
 *     summary: Create chat
 *     tags: [Chats]
 */

import type { NextRequest } from 'next/server';
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

import { withTracing } from '@/lib/tracing/http-middleware';

export const GET = withTracing('api.chats.list', async (request: NextRequest) => {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const workspace = await getServerSession();
  if (!workspace) {
    return apiError('WORKSPACE_NOT_FOUND', 'Workspace not found', 404);
  }

  const { searchParams } = new URL(request.url);
  const paginationParams = parsePaginationParams(searchParams);
  const validation = validatePaginationParams(paginationParams);

  if (!validation.valid) {
    return apiError('BAD_REQUEST', validation.error, 400);
  }

  const {
    takeCount,
    where: cursorWhere,
    orderBy,
  } = buildCursorQuery<{ id: string; updatedAt: Date }>(paginationParams, {
    cursorField: 'updatedAt',
  });

  const searchQuery = searchParams.get('search')?.trim();
  const where: Record<string, unknown> = {
    workspaceId: workspace.id,
    ...cursorWhere,
  };

  let chatIdsFromMessages: Set<string> | null = null;
  if (searchQuery) {
    const matchingMessages = await prisma.message.findMany({
      where: {
        content: { contains: searchQuery, mode: 'insensitive' },
        chat: { workspaceId: workspace.id },
      },
      select: { chatId: true },
      take: 200,
      distinct: ['chatId'],
    });
    chatIdsFromMessages = new Set(matchingMessages.map((m) => m.chatId));

    where.OR = [
      { title: { contains: searchQuery, mode: 'insensitive' } },
      ...(chatIdsFromMessages.size > 0 ? [{ id: { in: Array.from(chatIdsFromMessages) } }] : []),
    ];
  }

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
  return apiSuccess(
    {
      items: result.items.map((chat) => ({
        id: chat.id,
        title: chat.title,
        messageCount: chat._count.messages,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      })),
      pagination: result.pagination,
    },
    200,
    headers
  );
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return apiError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const workspace = await getServerSession();
  if (!workspace) {
    return apiError('WORKSPACE_NOT_FOUND', 'Workspace not found', 404);
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

  return apiSuccess(
    {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    },
    201
  );
}
