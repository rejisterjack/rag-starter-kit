import { Elysia, t } from 'elysia';
import { prisma } from '@/lib/db';
import {
  buildCursorQuery,
  buildPaginationResult,
  createPaginationHeaders,
  validatePaginationParams,
} from '@/lib/db/cursor-pagination';
import { requireAuth } from '../plugins/auth';

export const chatsRoutes = new Elysia({
  name: 'elysia/chats',
  prefix: '/chats',
})
  .use(requireAuth)
  .get(
    '/',
    async ({ workspace, query, set }) => {
      if (!workspace) {
        set.status = 404;
        return { error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } };
      }

      const paginationParams = {
        limit: query.limit,
        cursor: query.cursor,
        direction: query.direction,
      };
      const validation = validatePaginationParams(paginationParams);
      if (!validation.valid) {
        set.status = 400;
        return { error: { code: 'BAD_REQUEST', message: validation.error } };
      }

      const {
        takeCount,
        where: cursorWhere,
        orderBy,
      } = buildCursorQuery<{ id: string; updatedAt: Date }>(paginationParams, {
        cursorField: 'updatedAt',
      });

      const searchQuery = query.search?.trim();
      const where: Record<string, unknown> = {
        workspaceId: workspace.id,
        ...cursorWhere,
      };

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
        const chatIds = new Set(matchingMessages.map((m) => m.chatId));

        where.OR = [
          { title: { contains: searchQuery, mode: 'insensitive' } },
          ...(chatIds.size > 0 ? [{ id: { in: Array.from(chatIds) } }] : []),
        ];
      }

      const [chats, total] = await Promise.all([
        prisma.chat.findMany({
          where,
          orderBy,
          take: takeCount,
          include: { _count: { select: { messages: true } } },
        }),
        prisma.chat.count({ where: { workspaceId: workspace.id } }),
      ]);

      const result = buildPaginationResult(chats, paginationParams, {
        cursorField: 'updatedAt',
        totalCount: total,
      });

      set.headers = createPaginationHeaders(result);
      return {
        data: result.items.map((chat) => ({
          id: chat.id,
          title: chat.title,
          messageCount: chat._count.messages,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        })),
        pagination: result.pagination,
      };
    },
    {
      query: t.Object({
        limit: t.Number({ default: 20, minimum: 1, maximum: 100 }),
        cursor: t.Optional(t.String()),
        direction: t.Optional(t.Union([t.Literal('forward'), t.Literal('backward')])),
        search: t.Optional(t.String()),
      }),
    }
  )
  .post(
    '/',
    async ({ session, workspace, body, set }) => {
      if (!workspace) {
        set.status = 404;
        return { error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } };
      }

      const title = body.title?.trim() || 'New Chat';

      const chat = await prisma.chat.create({
        data: {
          title,
          workspaceId: workspace.id,
          userId: session?.userId,
        },
      });

      set.status = 201;
      return {
        data: {
          id: chat.id,
          title: chat.title,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        },
      };
    },
    {
      body: t.Object({
        title: t.Optional(t.String()),
      }),
    }
  );
