import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  return {
    title: 'Shared conversation',
    description: 'View a shared RAG Starter Kit conversation.',
    openGraph: {
      title: 'Shared conversation | RAG Starter Kit',
      description: 'View a shared AI conversation powered by RAG Starter Kit.',
      type: 'article',
    },
    robots: { index: false, follow: false },
    other: { 'share-token': token.slice(0, 8) },
  };
}

export default function ShareLayout({ children }: { children: ReactNode }) {
  return children;
}
