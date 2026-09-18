export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Environment Variables',
  description: 'Complete reference of all environment variables used by the RAG Starter Kit.',
};

interface EnvVar {
  name: string;
  required: boolean;
  default?: string;
  description: string;
}

const sections: { title: string; vars: EnvVar[] }[] = [
  {
    title: 'Core',
    vars: [
      {
        name: 'DATABASE_URL',
        required: true,
        description: 'PostgreSQL connection string for relational metadata',
      },
      {
        name: 'NEXTAUTH_SECRET',
        required: true,
        description: 'Session encryption key, min 32 characters',
      },
      { name: 'NEXTAUTH_URL', required: true, description: 'Public URL of your application' },
      {
        name: 'OPENROUTER_API_KEY',
        required: true,
        description: 'API key for OpenRouter LLM access',
      },
      {
        name: 'NODE_ENV',
        required: false,
        default: 'development',
        description: 'Runtime environment: development, production, test',
      },
      { name: 'PORT', required: false, default: '3000', description: 'HTTP server port' },
      {
        name: 'LOG_LEVEL',
        required: false,
        default: 'info',
        description: 'Logging verbosity: debug, info, warn, error',
      },
    ],
  },
  {
    title: 'Embeddings',
    vars: [
      {
        name: 'EMBEDDING_PROVIDER',
        required: false,
        default: 'google',
        description: 'Provider: google, openai, or ollama',
      },
      {
        name: 'EMBEDDING_MODEL',
        required: false,
        description: 'Specific model name (auto-detected if omitted)',
      },
      {
        name: 'EMBEDDING_DIMENSIONS',
        required: false,
        default: '768',
        description: 'Vector dimensions (must match DB schema)',
      },
      {
        name: 'GOOGLE_GENERATIVE_AI_API_KEY',
        required: false,
        description: 'Google Gemini API key (required for google provider)',
      },
      {
        name: 'OPENAI_API_KEY',
        required: false,
        description: 'OpenAI API key (required for openai provider)',
      },
      {
        name: 'OLLAMA_BASE_URL',
        required: false,
        description: 'Ollama server URL (default: http://localhost:11434)',
      },
    ],
  },
  {
    title: 'Redis',
    vars: [
      {
        name: 'UPSTASH_REDIS_REST_URL',
        required: false,
        description: 'Upstash Redis REST URL (required in production)',
      },
      {
        name: 'UPSTASH_REDIS_REST_TOKEN',
        required: false,
        description: 'Upstash Redis REST token (required in production)',
      },
    ],
  },
  {
    title: 'File Storage',
    vars: [
      { name: 'CLOUDINARY_URL', required: false, description: 'Cloudinary connection URL' },
      { name: 'CLOUDINARY_CLOUD_NAME', required: false, description: 'Cloudinary cloud name' },
      { name: 'CLOUDINARY_API_KEY', required: false, description: 'Cloudinary API key' },
      { name: 'CLOUDINARY_API_SECRET', required: false, description: 'Cloudinary API secret' },
      { name: 'CLOUDINARY_UPLOAD_FOLDER', required: false, description: 'Upload folder prefix' },
    ],
  },
  {
    title: 'Security',
    vars: [
      {
        name: 'ENCRYPTION_MASTER_KEY',
        required: false,
        description: 'Field-level encryption key (min 32 chars, required in production)',
      },
      {
        name: 'CSRF_SECRET',
        required: true,
        description: 'Dedicated CSRF token signing key (min 32 characters)',
      },
      {
        name: 'ALLOWED_ORIGINS',
        required: false,
        description: 'Comma-separated allowed CORS origins',
      },
      {
        name: 'CSP_CONNECT_SRC',
        required: false,
        description: 'Additional CSP connect-src domains',
      },
    ],
  },
  {
    title: 'OAuth Providers',
    vars: [
      { name: 'AUTH_GITHUB_ID', required: false, description: 'GitHub OAuth App client ID' },
      {
        name: 'AUTH_GITHUB_SECRET',
        required: false,
        description: 'GitHub OAuth App client secret',
      },
      { name: 'AUTH_GOOGLE_ID', required: false, description: 'Google OAuth client ID' },
      { name: 'AUTH_GOOGLE_SECRET', required: false, description: 'Google OAuth client secret' },
    ],
  },
  {
    title: 'Background Jobs',
    vars: [
      {
        name: 'INNGEST_SIGNING_KEY',
        required: false,
        description: 'Inngest signing key for webhook verification',
      },
      { name: 'INNGEST_EVENT_KEY', required: false, description: 'Inngest event key' },
    ],
  },
  {
    title: 'Other',
    vars: [
      { name: 'LOG_ENDPOINT', required: false, description: 'Remote logging endpoint URL' },
      {
        name: 'DATABASE_READ_REPLICA_URL',
        required: false,
        description: 'Read replica connection string (falls back to DATABASE_URL)',
      },
      { name: 'DB_POOL_MAX', required: false, description: 'Max database connection pool size' },
      { name: 'RESEND_API_KEY', required: false, description: 'Resend email API key' },
      { name: 'RESEND_FROM_EMAIL', required: false, description: 'Sender email address' },
      { name: 'RESEND_TO_EMAIL', required: false, description: 'Default recipient email' },
      {
        name: 'NEXT_PUBLIC_ANALYTICS_HOST',
        required: false,
        description: 'Plausible analytics host',
      },
      {
        name: 'NEXT_PUBLIC_ANALYTICS_SCRIPT_URL',
        required: false,
        description: 'Plausible analytics script URL',
      },
      { name: 'FIREWORKS_API_KEY', required: false, description: 'Fireworks AI API key' },
    ],
  },
];

export default function EnvironmentVariablesPage() {
  return (
    <DocsShell
      path="/docs/reference/environment-variables"
      title="Environment Variables"
      description="Complete list of environment variables with defaults and descriptions."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Environment Variables</h1>
        <p className="text-lg text-muted-foreground mb-8">
          All environment variables are validated at startup using Zod. Missing required variables
          cause the app to fail with a clear error message.
        </p>

        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr className="border-b border-border">
                      <th className="px-4 py-2 font-semibold">Variable</th>
                      <th className="px-4 py-2 font-semibold">Required</th>
                      <th className="px-4 py-2 font-semibold">Default</th>
                      <th className="px-4 py-2 font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {section.vars.map((v) => (
                      <tr key={v.name}>
                        <td className="px-4 py-2 font-mono text-xs text-primary whitespace-nowrap">
                          {v.name}
                        </td>
                        <td className="px-4 py-2">
                          {v.required ? (
                            <span className="text-red-500 font-medium">Yes</span>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                          {v.default || '—'}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{v.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>

        <div className="flex justify-between pt-8 border-t border-border">
          <Link
            href="/docs/reference"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Reference
          </Link>
          <Link
            href="/docs/reference/database-schema"
            className="text-sm text-primary hover:underline"
          >
            Database Schema &rarr;
          </Link>
        </div>
      </div>
    </DocsShell>
  );
}
