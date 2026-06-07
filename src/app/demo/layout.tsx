import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RAG Starter Kit - Live Demo',
  description:
    'Try the RAG Starter Kit chat interface. Ask questions about the documentation and see AI-powered retrieval-augmented generation in action.',
  openGraph: {
    title: 'RAG Starter Kit - Live Demo',
    description:
      'Try the RAG Starter Kit chat interface with AI-powered retrieval-augmented generation.',
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
