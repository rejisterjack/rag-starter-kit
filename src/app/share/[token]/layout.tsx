import type { Metadata } from 'next';
import { prisma } from '@/lib/db';

interface ShareLayoutProps {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: ShareLayoutProps): Promise<Metadata> {
  const { token } = await params;

  try {
    const share = await prisma.chatShare.findUnique({
      where: { shareToken: token },
      include: {
        chat: {
          select: { title: true },
        },
      },
    });

    if (share?.chat?.title) {
      return {
        title: `${share.chat.title} — Shared Chat`,
        description: `View this shared AI conversation: ${share.chat.title}`,
        openGraph: {
          title: share.chat.title,
          description: `Shared via RAG Starter Kit`,
          type: 'article',
        },
      };
    }
  } catch {
    // Database unavailable — use fallback metadata
  }

  return {
    title: 'Shared Chat — RAG Starter Kit',
    description: 'View a shared AI conversation',
  };
}

export default function ShareLayout({ children }: ShareLayoutProps) {
  return children;
}
