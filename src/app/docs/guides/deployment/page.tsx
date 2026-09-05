export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Deployment',
  description:
    'Deploy the RAG Starter Kit to Vercel, Railway, or Docker with production-ready configuration.',
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

export default function DeploymentPage() {
  return (
    <DocsShell
      path="/docs/guides/deployment"
      title="Deployment"
      description="Deploy the RAG Starter Kit to Vercel, Railway, Docker, or any Node host."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Deployment</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Deploy the RAG Starter Kit to any platform that supports Next.js. Here are guides for the
          most common options.
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-semibold mb-3">Vercel (Recommended)</h2>
            <p className="text-muted-foreground mb-3">
              Zero-config deployment with serverless functions and edge middleware.
            </p>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
              <li>Push your code to GitHub</li>
              <li>
                Import the repository in{' '}
                <a
                  href="https://vercel.com/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  vercel.com/new
                </a>
              </li>
              <li>Add environment variables in the Vercel dashboard</li>
              <li>Deploy</li>
            </ol>
            <div className="bg-muted/50 rounded-lg p-4 border border-border text-sm mt-3">
              <strong>Required env vars:</strong> DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL (your
              Vercel domain), OPENROUTER_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
              ENCRYPTION_MASTER_KEY
            </div>
            <Code title="vercel.json (optional, for long-running functions)">{`{
  "functions": {
    "src/app/api/chat/route.ts": {
      "maxDuration": 60
    }
  }
}`}</Code>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Railway</h2>
            <p className="text-muted-foreground mb-3">
              Simple deployment with built-in PostgreSQL and Redis.
            </p>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
              <li>
                Create a new project at{' '}
                <a
                  href="https://railway.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  railway.app
                </a>
              </li>
              <li>Add PostgreSQL and Redis services</li>
              <li>Deploy from GitHub repository</li>
              <li>Set environment variables using the Railway dashboard</li>
            </ol>
            <div className="bg-muted/50 rounded-lg p-4 border border-border text-sm mt-3">
              <strong>Tip:</strong> Railway provides DATABASE_URL and REDIS_URL automatically when
              you add those services. Run{' '}
              <code className="bg-card px-1 rounded">npx prisma db push</code> after first deploy to
              create tables.
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Docker</h2>
            <p className="text-muted-foreground mb-3">
              For self-hosted deployment on any server or cloud provider.
            </p>
            <Code title="docker-compose.yml">{`version: "3.8"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - db
      - redis

  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: ragkit
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:`}</Code>
            <Code title="Build and run">{`docker compose up -d
docker compose exec app npx prisma db push`}</Code>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Production Checklist</h2>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">&#10003;</span> Set{' '}
                <code className="bg-muted px-1 rounded text-sm">NODE_ENV=production</code>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">&#10003;</span> Generate a strong{' '}
                <code className="bg-muted px-1 rounded text-sm">NEXTAUTH_SECRET</code> (min 32
                chars)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">&#10003;</span> Configure{' '}
                <code className="bg-muted px-1 rounded text-sm">ENCRYPTION_MASTER_KEY</code> for
                field-level encryption
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">&#10003;</span> Set up Redis (Upstash or self-hosted)
                for rate limiting
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">&#10003;</span> Configure Cloudinary or S3 for file
                storage
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">&#10003;</span> Set up Inngest for background job
                processing
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">&#10003;</span> Enable SSL/TLS on your database
                connection
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">&#10003;</span> Review{' '}
                <code className="bg-muted px-1 rounded text-sm">ALLOWED_ORIGINS</code> and{' '}
                <code className="bg-muted px-1 rounded text-sm">CSP_CONNECT_SRC</code> for security
              </li>
            </ul>
          </section>

          <div className="flex justify-between pt-4 border-t border-border">
            <Link
              href="/docs/guides/llm-providers"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; LLM Providers
            </Link>
            <Link
              href="/docs/guides/authentication"
              className="text-sm text-primary hover:underline"
            >
              Authentication &rarr;
            </Link>
          </div>
        </div>
      </div>
    </DocsShell>
  );
}
