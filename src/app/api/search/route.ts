/**
 * Global Search API
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim();
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const userId = session.user.id;

    const workspaceFilter = {
      OR: [{ userId }, { workspace: { members: { some: { userId } } } }],
    };

    const [chats, documents, messages, workspaces] = await Promise.all([
      prisma.chat.findMany({
        where: {
          ...workspaceFilter,
          title: { contains: query, mode: 'insensitive' },
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
      }),

      prisma.document.findMany({
        where: {
          ...workspaceFilter,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
          ],
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
      }),

      prisma.message.findMany({
        where: {
          chat: workspaceFilter,
          content: { contains: query, mode: 'insensitive' },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          content: true,
          createdAt: true,
          chat: { select: { id: true, title: true } },
        },
      }),

      prisma.workspace.findMany({
        where: {
          members: { some: { userId } },
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { members: true, documents: true } },
        },
      }),
    ]);

    const results = [
      ...chats.map((chat) => ({
        id: chat.id,
        type: 'chat' as const,
        title: chat.title,
        subtitle: chat.workspace?.name || 'Personal',
        content: `${chat._count.messages} messages`,
        updatedAt: chat.updatedAt,
        url: `/chat/${chat.id}`,
      })),

      ...documents.map((doc) => ({
        id: doc.id,
        type: 'document' as const,
        title: doc.name,
        subtitle: doc.workspace?.name || 'Personal',
        content: doc.content?.slice(0, 200).replace(/\n/g, ' ') || '',
        updatedAt: doc.updatedAt,
        url: `/documents/${doc.id}`,
      })),

      ...messages.map((msg) => ({
        id: msg.id,
        type: 'message' as const,
        title: msg.chat?.title || 'Untitled Chat',
        subtitle: 'Message',
        content: msg.content.slice(0, 200),
        updatedAt: msg.createdAt,
        url: `/chat/${msg.chat.id}?message=${msg.id}`,
      })),

      ...workspaces.map((ws) => ({
        id: ws.id,
        type: 'workspace' as const,
        title: ws.name,
        subtitle: `${ws._count.members} members • ${ws._count.documents} documents`,
        updatedAt: new Date(),
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
      query,
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
