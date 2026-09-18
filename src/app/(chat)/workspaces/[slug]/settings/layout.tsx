import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = `${slug} settings`;
  return {
    title,
    description: `Manage workspace settings, members, and RAG configuration for ${slug}.`,
    openGraph: {
      title: `${title} | RAG Starter Kit`,
      description: 'Workspace settings and RAG configuration.',
    },
    robots: { index: false, follow: false },
  };
}

export default function WorkspaceSettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
