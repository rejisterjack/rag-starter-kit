import type { Metadata } from 'next';
import { DocsSidebar } from '@/components/docs/sidebar';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: {
    default: 'Documentation',
    template: '%s | RAG Starter Kit Docs',
  },
  description:
    'Complete documentation for the RAG Starter Kit. Learn how to install, configure, and deploy your AI-powered document chatbot.',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <DocsSidebar />
      <div className="lg:pl-64">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">{children}</div>
      </div>
    </div>
  );
}
