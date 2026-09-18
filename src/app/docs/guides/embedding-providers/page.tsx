export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Embedding Providers',
  description:
    'Configure Google Gemini, OpenAI, or Ollama for document embeddings in the RAG Starter Kit.',
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

export default function EmbeddingProvidersPage() {
  return (
    <DocsShell
      path="/docs/guides/embedding-providers"
      title="Embedding Providers"
      description="How to configure and switch embedding providers (Gemini, OpenAI, Ollama)."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Embedding Providers</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The RAG Starter Kit supports three embedding providers. The default is Google Gemini (free
          tier, 768D), which works out of the box with the database schema.
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-semibold mb-3">Provider Comparison</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-semibold">Provider</th>
                    <th className="px-4 py-2 font-semibold">Model</th>
                    <th className="px-4 py-2 font-semibold">Dimensions</th>
                    <th className="px-4 py-2 font-semibold">Cost</th>
                    <th className="px-4 py-2 font-semibold">Setup</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-2">Google Gemini</td>
                    <td className="px-4 py-2 font-mono text-xs">text-embedding-004</td>
                    <td className="px-4 py-2">768</td>
                    <td className="px-4 py-2 text-green-600">Free (1,500/day)</td>
                    <td className="px-4 py-2">API key only</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">OpenAI</td>
                    <td className="px-4 py-2 font-mono text-xs">text-embedding-3-small</td>
                    <td className="px-4 py-2">1536</td>
                    <td className="px-4 py-2">$0.02/1M tokens</td>
                    <td className="px-4 py-2">API key + migration</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Ollama</td>
                    <td className="px-4 py-2 font-mono text-xs">nomic-embed-text</td>
                    <td className="px-4 py-2">768</td>
                    <td className="px-4 py-2 text-green-600">Free (local)</td>
                    <td className="px-4 py-2">Local install</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Google Gemini (Default)</h2>
            <p className="text-muted-foreground mb-3">
              No configuration needed beyond the API key. Produces 768D vectors matching the
              database schema.
            </p>
            <Code title=".env">{`GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
EMBEDDING_PROVIDER=google`}</Code>
            <p className="text-muted-foreground text-sm">
              Get a free API key at{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                aistudio.google.com
              </a>
              . Free tier includes 1,500 requests/day.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">OpenAI</h2>
            <p className="text-muted-foreground mb-3">
              OpenAI embeddings produce 1536-dimensional vectors.{' '}
              <strong>You must run a database migration</strong> to change the vector column from
              768 to 1536 dimensions before switching.
            </p>
            <Code title=".env">{`EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
OPENAI_API_KEY=sk-...`}</Code>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800 text-sm mb-4">
              <strong>Important:</strong> After changing the embedding provider, existing documents
              will have mismatched embeddings. Use the re-embed workspace function to regenerate all
              embeddings.
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Ollama (Local)</h2>
            <p className="text-muted-foreground mb-3">
              Run embeddings locally with Ollama. The{' '}
              <code className="bg-muted px-1 rounded text-sm">nomic-embed-text</code> model produces
              768D vectors compatible with the default schema.
            </p>
            <Code title=".env">{`EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
OLLAMA_BASE_URL=http://localhost:11434`}</Code>
            <Code title="Install the model">{`ollama pull nomic-embed-text`}</Code>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Changing Providers</h2>
            <p className="text-muted-foreground mb-3">
              When you switch embedding providers, the system automatically detects the change and
              logs a warning. You should:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                Update the <code className="bg-muted px-1 rounded text-sm">.env</code> variables
              </li>
              <li>If dimensions changed, run a migration to update the vector column</li>
              <li>Trigger re-embedding for all existing documents</li>
              <li>
                Verify with the setup test endpoint:{' '}
                <code className="bg-muted px-1 rounded text-sm">GET /api/setup/test</code>
              </li>
            </ol>
          </section>

          <div className="flex justify-between pt-4 border-t border-border">
            <Link
              href="/docs/guides"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Guides
            </Link>
            <Link
              href="/docs/guides/llm-providers"
              className="text-sm text-primary hover:underline"
            >
              LLM Providers &rarr;
            </Link>
          </div>
        </div>
      </div>
    </DocsShell>
  );
}
