export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Getting Started',
  description:
    'Get up and running with the RAG Starter Kit. Learn what it is, how it works, and what you need before installing.',
};

export default function GettingStartedPage() {
  return (
    <DocsShell
      path="/docs/getting-started"
      title="Getting Started"
      description="Install, configure, and send your first chat message in under five minutes."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Getting Started</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The RAG Starter Kit is a production-ready boilerplate for building AI-powered document
          chatbots. It uses Retrieval-Augmented Generation (RAG) to give your LLM access to your own
          documents, so it can answer questions grounded in your data rather than hallucinating.
        </p>

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-3">What is RAG?</h2>
            <p className="text-muted-foreground mb-4">
              Retrieval-Augmented Generation is a technique that enhances LLM responses by first
              retrieving relevant documents from a knowledge base, then feeding those documents as
              context to the model. This means the chatbot can cite sources, stay up to date with
              your latest documents, and avoid making things up.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border border-border text-sm">
              <strong className="block mb-2">How it works in this project:</strong>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>You upload documents (PDF, DOCX, TXT, HTML, and more).</li>
                <li>Documents are split into chunks and embedded into vector representations.</li>
                <li>
                  Embeddings are stored in PostgreSQL with pgvector, next to document metadata.
                </li>
                <li>When a user sends a message, the system retrieves the most relevant chunks.</li>
                <li>Those chunks are injected into the LLM prompt as context.</li>
                <li>The LLM generates a grounded answer with citations.</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Tech Stack</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { name: 'Next.js 16', desc: 'App Router, Server Components, Streaming' },
                { name: 'TypeScript', desc: 'Full type safety across the stack' },
                { name: 'PostgreSQL + pgvector', desc: 'Vector storage and relational metadata' },
                { name: 'Prisma', desc: 'Type-safe database client and migrations' },
                {
                  name: 'NextAuth.js v5',
                  desc: 'Authentication with OAuth, credentials, and SAML SSO',
                },
                { name: 'Vercel AI SDK', desc: 'Streaming chat responses and tool calls' },
                { name: 'LangChain', desc: 'Document parsing, chunking, and retrieval' },
                { name: 'Tailwind CSS', desc: 'Utility-first styling with dark mode' },
                { name: 'Upstash Redis', desc: 'Serverless rate limiting and caching' },
                { name: 'Inngest', desc: 'Reliable background job processing' },
                { name: 'Cloudinary', desc: 'File storage with image optimization' },
                { name: 'Prisma Postgres', desc: 'Managed PostgreSQL with Accelerate' },
              ].map((tech) => (
                <div
                  key={tech.name}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{tech.name}</div>
                    <div className="text-xs text-muted-foreground">{tech.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Prerequisites</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">1.</span>
                <span>
                  <strong>Bun</strong> — runtime and package manager.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">2.</span>
                <span>
                  A <strong>PostgreSQL database with pgvector</strong> for metadata and vector
                  search. The easiest option is a free Prisma Postgres database at{' '}
                  <a
                    href="https://console.prisma.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    console.prisma.io
                  </a>
                  .
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">3.</span>
                <span>
                  An <strong>LLM API key</strong>. The default provider is OpenRouter which offers
                  free models. Get a key at{' '}
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    openrouter.ai/keys
                  </a>
                  .
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold mt-0.5">4.</span>
                <span>
                  A <strong>Google Gemini API key</strong> for embeddings (free tier: 1,500
                  requests/day). Get one at{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    aistudio.google.com
                  </a>
                  .
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Next Steps</h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/docs/getting-started/installation"
                className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Install the Kit
              </Link>
              <Link
                href="/docs/getting-started/quick-start"
                className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                5-Minute Quick Start
              </Link>
            </div>
          </section>
        </div>
      </div>
    </DocsShell>
  );
}
