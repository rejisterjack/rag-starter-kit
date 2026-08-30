import type { Metadata } from 'next';
import { buildHowToJsonLd } from '@/components/seo';

export const metadata: Metadata = {
  title: 'Live Demo',
  description:
    'Try the RAG Starter Kit live. Ask questions about the documentation and watch streaming RAG answers with citations.',
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildHowToJsonLd({
              name: 'How to try the RAG Starter Kit demo',
              description:
                'Chat with a RAG pipeline pre-loaded with the RAG Starter Kit documentation. No signup required.',
              steps: [
                'Open the live demo page.',
                'Type a question about RAG, pgvector, or deployment in the chat input.',
                'Send the message and watch the answer stream token-by-token.',
                'Ask follow-up questions — retrieval re-runs per message.',
                'Read the documentation or clone the repo to run the same pipeline yourself.',
              ],
            })
          ),
        }}
      />
      {children}
    </>
  );
}
