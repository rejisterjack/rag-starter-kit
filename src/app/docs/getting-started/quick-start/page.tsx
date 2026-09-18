export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Quick Start',
  description: 'Get a working RAG chatbot in 5 minutes with this step-by-step quick start guide.',
};

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
          {number}
        </span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="ml-11 space-y-3">{children}</div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="bg-card border border-border rounded-lg p-4 overflow-x-auto text-sm mb-3">
      <code>{children}</code>
    </pre>
  );
}

export default function QuickStartPage() {
  return (
    <DocsShell
      path="/docs/getting-started/quick-start"
      title="Quick Start"
      description="Get a working RAG chatbot in 5 minutes with this step-by-step quick start guide."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Quick Start</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Go from zero to a working AI chatbot in under five minutes.
        </p>

        <div className="space-y-2">
          <Step number={1} title="Clone and install">
            <Code>{`git clone https://github.com/rejisterjack/rag-starter-kit.git my-rag-app
cd my-rag-app
bun install`}</Code>
          </Step>

          <Step number={2} title="Set environment variables">
            <Code>{`cp .env.example .env`}</Code>
            <p className="text-muted-foreground">
              Open <code className="bg-muted px-1.5 py-0.5 rounded text-sm">.env</code> and fill in
              these four required values:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border border-border text-sm space-y-2">
              <div>
                <strong>DATABASE_URL</strong> — Get a free Prisma Postgres database at{' '}
                <a
                  href="https://console.prisma.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  console.prisma.io
                  <span className="sr-only">(opens in new tab)</span>
                </a>
              </div>
              <div>
                <strong>NEXTAUTH_SECRET</strong> — Generate:{' '}
                <code className="bg-card px-1.5 py-0.5 rounded">openssl rand -base64 32</code>
              </div>
              <div>
                <strong>NEXTAUTH_URL</strong> — Use{' '}
                <code className="bg-card px-1.5 py-0.5 rounded">http://localhost:7392</code>
              </div>
              <div>
                <strong>OPENROUTER_API_KEY</strong> — Get a free key at{' '}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  openrouter.ai/keys
                  <span className="sr-only">(opens in new tab)</span>
                </a>
              </div>
            </div>
          </Step>

          <Step number={3} title="Set up the database">
            <Code>{`npx prisma db push`}</Code>
            <p className="text-muted-foreground">
              This creates all tables including pgvector columns and HNSW indexes.
            </p>
          </Step>

          <Step number={4} title="Start the development server">
            <Code>{`bun dev`}</Code>
            <p className="text-muted-foreground">
              Open{' '}
              <a
                href="http://localhost:7392"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                http://localhost:7392
                <span className="sr-only">(opens in new tab)</span>
              </a>{' '}
              and create an account.
            </p>
          </Step>

          <Step number={5} title="Upload a document and chat">
            <p className="text-muted-foreground">
              After onboarding, you land in the chat interface. Click the upload button in the
              sidebar to add a PDF, DOCX, or TXT file. Once ingested (usually 10-30 seconds), ask
              questions about your document.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border border-border text-sm">
              <strong>Tip:</strong> The first message after uploading may take a moment as the
              embedding model warms up. Subsequent responses stream in real time.
            </div>
          </Step>

          <div className="mt-12 p-6 rounded-lg border border-border bg-card">
            <h3 className="font-semibold mb-2">What&apos;s next?</h3>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>
                <Link
                  href="/docs/guides/embedding-providers"
                  className="text-primary hover:underline"
                >
                  Switch embedding providers
                </Link>{' '}
                — try OpenAI or local Ollama models
              </li>
              <li>
                <Link href="/docs/guides/llm-providers" className="text-primary hover:underline">
                  Configure LLM providers
                </Link>{' '}
                — use Anthropic, Google, or local models
              </li>
              <li>
                <Link href="/docs/guides/authentication" className="text-primary hover:underline">
                  Set up OAuth
                </Link>{' '}
                — add GitHub or Google sign-in
              </li>
              <li>
                <Link href="/docs/guides/deployment" className="text-primary hover:underline">
                  Deploy to production
                </Link>{' '}
                — Vercel, Railway, or Docker
              </li>
            </ul>
          </div>

          <div className="flex justify-between pt-4 border-t border-border">
            <Link
              href="/docs/getting-started/configuration"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Configuration
            </Link>
            <Link href="/docs/api" className="text-sm text-primary hover:underline">
              API Reference &rarr;
            </Link>
          </div>
        </div>
      </div>
    </DocsShell>
  );
}
