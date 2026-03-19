/**
 * GDPR Compliance Utilities
 */

import { prisma } from '@/lib/db';

export interface DataExport {
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: Date;
  };
  chats: Array<{
    id: string;
    title: string;
    messages: Array<{
      id: string;
      content: string;
      role: string;
      createdAt: Date;
    }>;
  }>;
  documents: Array<{
    id: string;
    name: string;
    uploadedAt: Date;
  }>;
  workspaces: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  auditLogs: Array<{
    id: string;
    event: string;
    createdAt: Date;
    metadata: unknown;
  }>;
}

export async function exportUserData(userId: string): Promise<DataExport> {
  const [user, chats, documents, memberships, auditLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true },
    }),
    prisma.chat.findMany({
      where: { userId },
      include: {
        messages: {
          select: { id: true, content: true, role: true, createdAt: true },
        },
      },
    }),
    prisma.document.findMany({
      where: { userId },
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { userId },
      select: { id: true, event: true, createdAt: true, metadata: true },
    }),
  ]);

  if (!user) {
    throw new Error('User not found');
  }

  return {
    user,
    chats: chats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      messages: chat.messages,
    })),
    documents: documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      uploadedAt: doc.createdAt,
    })),
    workspaces: memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      role: m.role,
    })),
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      event: log.event,
      createdAt: log.createdAt,
      metadata: log.metadata,
    })),
  };
}

export async function deleteUserData(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.apiKey.deleteMany({ where: { userId } });
    await tx.message.deleteMany({ where: { chat: { userId } } });
    await tx.chat.deleteMany({ where: { userId } });
    await tx.document.deleteMany({ where: { userId } });
    await tx.workspaceMember.deleteMany({ where: { userId } });
    await tx.auditLog.updateMany({ where: { userId }, data: { userId: null } });
    await tx.user.delete({ where: { id: userId } });
  });
}

export default { exportUserData, deleteUserData };
