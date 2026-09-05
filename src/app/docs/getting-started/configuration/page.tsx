export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Configuration',
  description:
    'Configure environment variables, AI providers, and system settings for the RAG Starter Kit.',
};

function EnvRow({
  name,
  required,
  defaultVal,
  desc,
}: {
  name: string;
  required: boolean;
  defaultVal?: string;
  desc: string;
}) {
  return (
    <tr className="border-b border-border">
      <td className="py-2 pr-4 font-mono text-sm text-primary whitespace-nowrap">{name}</td>
      <td className="py-2 pr-4 text-sm">
        {required ? (
          <span className="text-red-500 font-medium">Required</span>
        ) : (
          <span className="text-muted-foreground">Optional</span>
        )}
      </td>
      {defaultVal !== undefined && (
        <td className="py-2 pr-4 text-sm text-muted-foreground font-mono">{defaultVal}</td>
      )}
      <td className="py-2 text-sm text-muted-foreground">{desc}</td>
    </tr>
  );
}

export default function ConfigurationPage() {
  return (
    <DocsShell
      path="/docs/getting-started/configuration"
      title="Configuration"
      description="All environment variables and configuration options for the RAG Starter Kit."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Configuration</h1>
        <p className="text-lg text-muted-foreground mb-8">
          All configuration is handled through environment variables. Copy{' '}
          <code className="bg-muted px-1.5 py-0.5 rounded text-sm">.env.example</code> to{' '}
          <code className="bg-muted px-1.5 py-0.5 rounded text-sm">.env</code> and fill in the
          values.
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Core</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Variable
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Required
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Default
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="px-4">
                  <EnvRow
                    name="DATABASE_URL"
                    required
                    desc="PostgreSQL connection string for metadata storage"
                  />
                  <EnvRow
                    name="NEXTAUTH_SECRET"
                    required
                    desc="Session encryption key (min 32 chars, generate with openssl rand -base64 32)"
                  />
                  <EnvRow
                    name="NEXTAUTH_URL"
                    required
                    desc="Public URL of your app (e.g. http://localhost:7392)"
                  />
                  <EnvRow
                    name="OPENROUTER_API_KEY"
                    required
                    desc="OpenRouter API key for LLM access"
                  />
                  <EnvRow
                    name="NODE_ENV"
                    required={false}
                    defaultVal="development"
                    desc="development, production, or test"
                  />
                  <EnvRow name="PORT" required={false} defaultVal="3000" desc="HTTP server port" />
                  <EnvRow
                    name="LOG_LEVEL"
                    required={false}
                    defaultVal="info"
                    desc="Logging verbosity: debug, info, warn, error"
                  />
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Embeddings</h2>
            <p className="text-muted-foreground mb-4">
              The embedding model determines how documents are converted to vectors. The default
              (Google Gemini) produces 768-dimensional vectors which match the database schema. If
              you change the provider, you must also run a migration to update the vector column
              dimension.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Variable
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Required
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Default
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="px-4">
                  <EnvRow
                    name="EMBEDDING_PROVIDER"
                    required={false}
                    defaultVal="google"
                    desc="google, openai, or ollama"
                  />
                  <EnvRow
                    name="EMBEDDING_MODEL"
                    required={false}
                    desc="Specific model name (auto-detected if omitted)"
                  />
                  <EnvRow
                    name="EMBEDDING_DIMENSIONS"
                    required={false}
                    defaultVal="768"
                    desc="Vector dimensions (must match DB schema)"
                  />
                  <EnvRow
                    name="GOOGLE_GENERATIVE_AI_API_KEY"
                    required={false}
                    desc="Required if EMBEDDING_PROVIDER=google"
                  />
                  <EnvRow
                    name="OPENAI_API_KEY"
                    required={false}
                    desc="Required if EMBEDDING_PROVIDER=openai"
                  />
                  <EnvRow
                    name="OLLAMA_BASE_URL"
                    required={false}
                    defaultVal="http://localhost:11434"
                    desc="Ollama server URL (if EMBEDDING_PROVIDER=ollama)"
                  />
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Redis (Rate Limiting)</h2>
            <p className="text-muted-foreground mb-4">
              Required in production. In development, an in-memory fallback is used automatically.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Variable
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Required
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="px-4">
                  <EnvRow
                    name="UPSTASH_REDIS_REST_URL"
                    required={false}
                    desc="Upstash Redis REST URL (required in production)"
                  />
                  <EnvRow
                    name="UPSTASH_REDIS_REST_TOKEN"
                    required={false}
                    desc="Upstash Redis REST token (required in production)"
                  />
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">File Storage</h2>
            <p className="text-muted-foreground mb-4">
              In development, files are stored locally. In production, Cloudinary is used for cloud
              storage.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Variable
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Required
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="px-4">
                  <EnvRow name="CLOUDINARY_URL" required={false} desc="Cloudinary connection URL" />
                  <EnvRow
                    name="CLOUDINARY_CLOUD_NAME"
                    required={false}
                    desc="Cloudinary cloud name"
                  />
                  <EnvRow name="CLOUDINARY_API_KEY" required={false} desc="Cloudinary API key" />
                  <EnvRow
                    name="CLOUDINARY_API_SECRET"
                    required={false}
                    desc="Cloudinary API secret"
                  />
                  <EnvRow
                    name="CLOUDINARY_UPLOAD_FOLDER"
                    required={false}
                    desc="Folder prefix for uploaded files"
                  />
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Security</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left">
                <thead className="bg-muted/50">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Variable
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Required
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Default
                    </th>
                    <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="px-4">
                  <EnvRow
                    name="ENCRYPTION_MASTER_KEY"
                    required={false}
                    desc="Encryption key for SAML keys and webhook secrets (min 32 chars, required in production)"
                  />
                  <EnvRow
                    name="CSRF_SECRET"
                    required={true}
                    desc="Dedicated CSRF token signing key (min 32 characters)"
                  />
                  <EnvRow
                    name="ALLOWED_ORIGINS"
                    required={false}
                    desc="Comma-separated CORS origins"
                  />
                  <EnvRow
                    name="CSP_CONNECT_SRC"
                    required={false}
                    desc="Additional domains for CSP connect-src directive"
                  />
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex justify-between pt-4 border-t border-border">
            <Link
              href="/docs/getting-started/installation"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Installation
            </Link>
            <Link
              href="/docs/getting-started/quick-start"
              className="text-sm text-primary hover:underline"
            >
              Quick Start &rarr;
            </Link>
          </div>
        </div>
      </div>
    </DocsShell>
  );
}
