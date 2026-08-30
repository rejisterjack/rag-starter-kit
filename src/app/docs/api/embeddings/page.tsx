export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Embeddings API',
  description:
    'Generate text embeddings and perform vector similarity search against your document knowledge base.',
};

function Code({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden mb-4">
      {title && (
        <div className="bg-muted px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border">
          {title}
        </div>
      )}
      <pre className="bg-card p-4 overflow-x-auto text-sm">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export default function EmbeddingsApiPage() {
  return (
    <DocsShell
      path="/docs/api/embeddings"
      title="Embeddings API"
      description="Embedding endpoint reference: providers, dimensions, and batch limits."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Embeddings API</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Generate vector embeddings for text and search your document knowledge base using semantic
          similarity.
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-semibold mb-3">Generate Embeddings</h2>
            <div className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-mono font-bold mb-3">
              POST
            </div>
            <code className="text-sm ml-2">/api/embeddings</code>

            <h3 className="font-semibold mt-4 mb-2">Request Body</h3>
            <Code title="application/json">{`{
  "texts": [
    "What is the company refund policy?",
    "How do I contact support?"
  ]
}`}</Code>

            <h3 className="font-semibold mt-4 mb-2">Response</h3>
            <Code title="application/json">{`{
  "embeddings": [
    [0.023, -0.041, 0.087, ...],  // 768-dimensional vector
    [0.015, -0.033, 0.092, ...]   // 768-dimensional vector
  ],
  "model": "text-embedding-004",
  "dimensions": 768
}`}</Code>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Vector Similarity Search</h2>
            <div className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-mono font-bold mb-3">
              POST
            </div>
            <code className="text-sm ml-2">/api/embeddings/search</code>

            <h3 className="font-semibold mt-4 mb-2">Request Body</h3>
            <Code title="application/json">{`{
  "query": "What is the refund policy?",
  "topK": 5,
  "minScore": 0.7,
  "documentIds": ["doc_abc123"]  // optional, filters by specific documents
}`}</Code>

            <h3 className="font-semibold mt-4 mb-2">Response</h3>
            <Code title="application/json">{`{
  "results": [
    {
      "chunkId": "chunk_001",
      "documentId": "doc_abc123",
      "documentName": "terms-of-service.pdf",
      "content": "Refunds are available within 30 days of purchase...",
      "score": 0.94,
      "metadata": {
        "page": 4,
        "chunkIndex": 12
      }
    }
  ],
  "query": "What is the refund policy?"
}`}</Code>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">How It Works</h2>
            <p className="text-muted-foreground mb-3">
              The embedding pipeline uses the configured provider (default: Google Gemini) to
              convert text into high-dimensional vectors. These vectors are stored in PostgreSQL
              with pgvector, enabling fast cosine similarity search using HNSW indexes.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border border-border text-sm">
              <strong className="block mb-2">Dimension compatibility:</strong>
              <p className="text-muted-foreground">
                The database schema uses <code className="bg-card px-1 rounded">vector(768)</code>.
                If you change the embedding provider (e.g. to OpenAI which produces 1536D vectors),
                you must also update the schema dimension. The app validates this at startup and
                warns about mismatches.
              </p>
            </div>
          </section>

          <div className="flex justify-between pt-4 border-t border-border">
            <Link
              href="/docs/api/documents"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Documents API
            </Link>
            <Link href="/docs/guides" className="text-sm text-primary hover:underline">
              Guides &rarr;
            </Link>
          </div>
        </div>
      </div>
    </DocsShell>
  );
}
