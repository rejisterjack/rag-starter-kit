/**
 * Global Search API with Filters
 * Supports: type, dateFrom, dateTo filters
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const VALID_TYPES = ['chat', 'document', 'message', 'workspace'] as const;
type SearchType = typeof VALID_TYPES[number];

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim();
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);
    
    // Parse filters
    const typesParam = searchParams.get('type');
    const types = typesParam 
      ? typesParam.split(',').filter((t): t is SearchType => VALID_TYPES.includes(t as SearchType))
      : VALID_TYPES;
    
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [], filters: { types, dateFrom, dateTo } });
    }

    const userId = session.user.id;

    const workspaceFilter = {
      OR: [{ userId }, { workspace: { members: { some: { userId } } } }],
    };

    // Build queries based on type filter
    const queries: Promise<unknown[]>[] = [];

    if (types.includes('chat')) {
      queries.push(
        prisma.chat.findMany({
          where: {
            ...workspaceFilter,
            title: { contains: query, mode: 'insensitive' },
            ...(hasDateFilter && { updatedAt: dateFilter }),
          },
          take: limit,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            updatedAt: true,
            workspace: { select: { name: true } },
            _count: { select: { messages: true } },
          },
        })
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    if (types.includes('document')) {
      queries.push(
        prisma.document.findMany({
          where: {
            ...workspaceFilter,
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { content: { contains: query, mode: 'insensitive' } },
            ],
            ...(hasDateFilter && { updatedAt: dateFilter }),
          },
          take: limit,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            content: true,
            updatedAt: true,
            workspace: { select: { name: true } },
          },
        })
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    if (types.includes('message')) {
      queries.push(
        prisma.message.findMany({
          where: {
            chat: workspaceFilter,
            content: { contains: query, mode: 'insensitive' },
            ...(hasDateFilter && { createdAt: dateFilter }),
          },
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            createdAt: true,
            chat: { select: { id: true, title: true } },
          },
        })
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    if (types.includes('workspace')) {
      queries.push(
        prisma.workspace.findMany({
          where: {
            members: { some: { userId } },
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { slug: { contains: query, mode: 'insensitive' } },
            ],
            ...(hasDateFilter && { createdAt: dateFilter }),
          },
          take: limit,
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            _count: { select: { members: true, documents: true } },
          },
        })
      );
    } else {
      queries.push(Promise.resolve([]));
    }

    const [chats, documents, messages, workspaces] = await Promise.all(queries);

    const results = [
      ...(chats as Array<{
        id: string;
        title: string;
        updatedAt: Date;
        workspace?: { name: string };
        _count: { messages: number };
      }>).map((chat) => ({
        id: chat.id,
        type: 'chat' as const,
        title: chat.title,
        subtitle: chat.workspace?.name || 'Personal',
        content: `${chat._count.messages} messages`,
        updatedAt: chat.updatedAt,
        url: `/chat/${chat.id}`,
      })),

      ...(documents as Array<{
        id: string;
        name: string;
        content: string | null;
        updatedAt: Date;
        workspace?: { name: string };
      }>).map((doc) => ({
        id: doc.id,
        type: 'document' as const,
        title: doc.name,
        subtitle: doc.workspace?.name || 'Personal',
        content: doc.content?.slice(0, 200).replace(/\n/g, ' ') || '',
        updatedAt: doc.updatedAt,
        url: `/documents/${doc.id}`,
      })),

      ...(messages as Array<{
        id: string;
        content: string;
        createdAt: Date;
        chat?: { id: string; title: string | null };
      }>).map((msg) => ({
        id: msg.id,
        type: 'message' as const,
        title: msg.chat?.title || 'Untitled Chat',
        subtitle: 'Message',
        content: msg.content.slice(0, 200),
        updatedAt: msg.createdAt,
        url: `/chat/${msg.chat?.id}?message=${msg.id}`,
      })),

      ...(workspaces as Array<{
        id: string;
        name: string;
        slug: string;
        createdAt: Date;
        _count: { members: number; documents: number };
      }>).map((ws) => ({
        id: ws.id,
        type: 'workspace' as const,
        title: ws.name,
        subtitle: `${ws._count.members} members • ${ws._count.documents} documents`,
        updatedAt: ws.createdAt,
        url: `/workspaces/${ws.slug}`,
      })),
    ];

    // Sort by relevance
    const scoredResults = results.map((result) => {
      let score = 0;
      const titleLower = result.title.toLowerCase();
      const queryLower = query.toLowerCase();

      if (titleLower === queryLower) score += 100;
      else if (titleLower.startsWith(queryLower)) score += 50;
      else if (titleLower.includes(queryLower)) score += 25;

      return { ...result, score };
    });

    scoredResults.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return NextResponse.json({
      results: scoredResults.slice(0, limit),
      total: scoredResults.length,
      filters: {
        types,
        dateFrom,
        dateTo,
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
