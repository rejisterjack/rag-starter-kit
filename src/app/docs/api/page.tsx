export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'API Reference',
  description:
    'Complete API reference for the RAG Starter Kit. Chat, documents, embeddings, and more.',
};

interface EndpointSummary {
  method: string;
  path: string;
  description: string;
  href: string;
}

const endpoints: EndpointSummary[] = [
  {
    method: 'POST',
    path: '/api/chat',
    description: 'Send a message and receive an AI-powered response with RAG context',
    href: '/docs/api/chat',
  },
  {
    method: 'GET',
    path: '/api/chat',
    description: 'Retrieve conversation history and messages',
    href: '/docs/api/chat',
  },
  {
    method: 'POST',
    path: '/api/documents',
    description: 'Upload a document for ingestion and embedding',
    href: '/docs/api/documents',
  },
  {
    method: 'GET',
    path: '/api/documents',
    description: 'List all documents in the workspace',
    href: '/docs/api/documents',
  },
  {
    method: 'GET',
    path: '/api/documents/:id',
    description: 'Get document details and ingestion status',
    href: '/docs/api/documents',
  },
  {
    method: 'DELETE',
    path: '/api/documents/:id',
    description: 'Delete a document and its chunks',
    href: '/docs/api/documents',
  },
  {
    method: 'POST',
    path: '/api/documents/:id/re-ingest',
    description: 'Re-process a document (e.g. after fixing an error)',
    href: '/docs/api/documents',
  },
  {
    method: 'POST',
    path: '/api/embeddings',
    description: 'Generate embeddings for arbitrary text',
    href: '/docs/api/embeddings',
  },
  {
    method: 'POST',
    path: '/api/embeddings/search',
    description: 'Search for similar documents using vector similarity',
    href: '/docs/api/embeddings',
  },
];

function methodColor(method: string): string {
  switch (method) {
    case 'GET':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'POST':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'DELETE':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export default function ApiOverviewPage() {
  return (
    <DocsShell
      path="/docs/api"
      title="API Reference"
      description="Complete REST API reference for chat, document ingestion, embeddings, and workspaces."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">API Reference</h1>
        <p className="text-lg text-muted-foreground mb-8">
          All API endpoints require authentication via session cookie or API key. Responses are JSON
          unless otherwise noted.
        </p>

        <div className="space-y-6 mb-8">
          <div className="bg-muted/50 rounded-lg p-4 border border-border text-sm">
            <strong>Base URL:</strong>{' '}
            <code className="bg-card px-1.5 py-0.5 rounded">https://your-domain.com/api</code>
          </div>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Authentication</h2>
            <p className="text-muted-foreground mb-3">All endpoints require one of:</p>
            <ul className="space-y-2 text-muted-foreground list-disc list-inside">
              <li>A valid session cookie (browser-based authentication via NextAuth)</li>
              <li>
                An API key in the{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm">Authorization</code>{' '}
                header:{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm">Bearer sk-...</code>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Endpoints</h2>
            <div className="space-y-2">
              {endpoints.map((ep) => (
                <Link
                  key={`${ep.method}-${ep.path}`}
                  href={ep.href}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${methodColor(ep.method)}`}
                  >
                    {ep.method}
                  </span>
                  <span className="font-mono text-sm shrink-0">{ep.path}</span>
                  <span className="text-sm text-muted-foreground">— {ep.description}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="flex justify-between pt-4 border-t border-border">
          <Link
            href="/docs/guides"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Guides
          </Link>
          <Link href="/docs/api/chat" className="text-sm text-primary hover:underline">
            Chat API &rarr;
          </Link>
        </div>
      </div>
    </DocsShell>
  );
}
