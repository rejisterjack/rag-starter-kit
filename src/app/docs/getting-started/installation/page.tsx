export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Installation',
  description:
    'Step-by-step guide to install the RAG Starter Kit, clone the repository, configure environment variables, and set up the database.',
};

function CodeBlock({ children, title }: { children: string; title?: string }) {
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

export default function InstallationPage() {
  return (
    <DocsShell
      path="/docs/getting-started/installation"
      title="Installation"
      description="Step-by-step installation for the RAG Starter Kit including prerequisites and database setup."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Installation</h1>
        <p className="text-lg text-muted-foreground mb-8">
          Get the RAG Starter Kit running on your local machine. The entire setup takes about five
          minutes if you already have the prerequisite accounts.
        </p>

        <div className="space-y-10">
          {/* Step 1 */}
          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-sm font-bold">
                1
              </span>
              Clone the Repository
            </h2>
            <CodeBlock title="Terminal">
              {`git clone https://github.com/rejisterjack/rag-starter-kit.git
cd rag-starter-kit`}
            </CodeBlock>
          </section>

          {/* Step 2 */}
          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-sm font-bold">
                2
              </span>
              Install Dependencies
            </h2>
            <p className="text-muted-foreground mb-3">
              The project uses Bun as its runtime and package manager. If you don't have it
              installed:
            </p>
            <CodeBlock title="Terminal">
              {`# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Install all dependencies
bun install`}
            </CodeBlock>
          </section>

          {/* Step 3 */}
          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-sm font-bold">
                3
              </span>
              Set Up Environment Variables
            </h2>
            <p className="text-muted-foreground mb-3">
              Copy the example environment file and fill in your API keys:
            </p>
            <CodeBlock title="Terminal">{`cp .env.example .env`}</CodeBlock>
            <p className="text-muted-foreground mb-3">
              Open <code className="text-sm bg-muted px-1.5 py-0.5 rounded">.env</code> in your
              editor and update these required values:
            </p>
            <div className="rounded-lg border border-border overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2 font-medium">Variable</th>
                    <th className="text-left px-4 py-2 font-medium">Where to get it</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">DATABASE_URL</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      Create a free database at{' '}
                      <a
                        href="https://console.prisma.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        console.prisma.io
                        <span className="sr-only">(opens in new tab)</span>
                      </a>
                      . Copy the Accelerate connection string.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">OPENROUTER_API_KEY</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      Sign up at{' '}
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        openrouter.ai/keys
                        <span className="sr-only">(opens in new tab)</span>
                      </a>{' '}
                      and generate a key. Free models are available.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">GOOGLE_GENERATIVE_AI_API_KEY</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      Get a free key at{' '}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        aistudio.google.com
                        <span className="sr-only">(opens in new tab)</span>
                      </a>
                      . Used for vector embeddings.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">NEXTAUTH_SECRET</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      Generate one with:{' '}
                      <code className="bg-muted px-1 rounded">openssl rand -base64 32</code>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">NEXTAUTH_URL</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      Set to <code className="bg-muted px-1 rounded">http://localhost:7392</code>{' '}
                      for local development.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground">
              See the{' '}
              <Link
                href="/docs/reference/environment-variables"
                className="text-primary hover:underline"
              >
                full environment variables reference
              </Link>{' '}
              for every available option.
            </p>
          </section>

          {/* Step 4 */}
          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-sm font-bold">
                4
              </span>
              Set Up the Database
            </h2>
            <p className="text-muted-foreground mb-3">
              Run the Prisma migrations to set up your database:
            </p>
            <CodeBlock title="Terminal">
              {`# Run database migrations
bun db:migrate

# Generate the Prisma client
bun db:generate`}
            </CodeBlock>
            <p className="text-muted-foreground">If you want some seed data to explore the UI:</p>
            <CodeBlock title="Terminal">{`bun db:seed`}</CodeBlock>
          </section>

          {/* Step 5 */}
          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-sm font-bold">
                5
              </span>
              Start the Development Server
            </h2>
            <CodeBlock title="Terminal">{`bun dev`}</CodeBlock>
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
              in your browser. Register an account, upload a document, and start chatting.
            </p>
          </section>

          {/* Optional services */}
          <section>
            <h2 className="text-xl font-semibold mb-3">Optional Services</h2>
            <p className="text-muted-foreground mb-3">
              These are not required for local development but are recommended for production:
            </p>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <strong>Cloudinary</strong> -- File uploads. Without it, files are stored on the
                local filesystem. Get a free account at{' '}
                <a
                  href="https://cloudinary.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  cloudinary.com
                  <span className="sr-only">(opens in new tab)</span>
                </a>
                .
              </li>
              <li>
                <strong>Upstash Redis</strong> -- Rate limit persistence. Without it, an in-memory
                fallback is used in development. Get a free database at{' '}
                <a
                  href="https://console.upstash.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  console.upstash.com
                  <span className="sr-only">(opens in new tab)</span>
                </a>
                .
              </li>
              <li>
                <strong>Resend</strong> -- Email notifications (welcome emails, password resets).
                Without it, emails are logged to the console. Sign up at{' '}
                <a
                  href="https://resend.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  resend.com
                  <span className="sr-only">(opens in new tab)</span>
                </a>
                .
              </li>
              <li>
                <strong>Inngest</strong> -- Background job processing. Run{' '}
                <code className="bg-muted px-1 rounded text-sm">bun inngest:dev</code> for a local
                dev server.
              </li>
            </ul>
          </section>

          <section className="flex gap-3">
            <Link
              href="/docs/getting-started/configuration"
              className="inline-flex items-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Next: Configuration
            </Link>
            <Link
              href="/docs/getting-started/quick-start"
              className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              Skip to Quick Start
            </Link>
          </section>
        </div>
      </div>
    </DocsShell>
  );
}
