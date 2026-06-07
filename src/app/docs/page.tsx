import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Documentation',
  description:
    'Everything you need to build, deploy, and scale AI-powered document chatbots with the RAG Starter Kit.',
};

const sections = [
  {
    title: 'Getting Started',
    description:
      'Install the RAG Starter Kit, configure your environment, and send your first chat message in under five minutes.',
    href: '/docs/getting-started',
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        role="img"
        aria-label="Getting Started"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
        />
      </svg>
    ),
    links: [
      { label: 'Installation', href: '/docs/getting-started/installation' },
      { label: 'Configuration', href: '/docs/getting-started/configuration' },
      { label: 'Quick Start', href: '/docs/getting-started/quick-start' },
    ],
  },
  {
    title: 'API Reference',
    description:
      'Complete reference for the REST API endpoints, including chat, document ingestion, health checks, and workspace management.',
    href: '/docs/api',
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        role="img"
        aria-label="API Reference"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
        />
      </svg>
    ),
    links: [
      { label: 'Chat API', href: '/docs/api/chat' },
      { label: 'Documents API', href: '/docs/api/documents' },
      { label: 'Embeddings', href: '/docs/api/embeddings' },
    ],
  },
  {
    title: 'Guides',
    description:
      'Step-by-step guides for configuring embedding and LLM providers, deploying to production, and enabling authentication.',
    href: '/docs/guides',
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        role="img"
        aria-label="Guides"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
        />
      </svg>
    ),
    links: [
      { label: 'Embedding Providers', href: '/docs/guides/embedding-providers' },
      { label: 'LLM Providers', href: '/docs/guides/llm-providers' },
      { label: 'Deployment', href: '/docs/guides/deployment' },
      { label: 'Authentication', href: '/docs/guides/authentication' },
    ],
  },
  {
    title: 'Reference',
    description:
      'Detailed reference material for environment variables, database schema, and the RBAC permission system.',
    href: '/docs/reference',
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        role="img"
        aria-label="Reference"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
        />
      </svg>
    ),
    links: [
      { label: 'Environment Variables', href: '/docs/reference/environment-variables' },
      { label: 'Database Schema', href: '/docs/reference/database-schema' },
      { label: 'RBAC Permissions', href: '/docs/reference/rbac-permissions' },
    ],
  },
];

export default function DocsHomePage() {
  return (
    <div>
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Documentation</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Everything you need to build, deploy, and scale AI-powered document chatbots with the RAG
          Starter Kit. Built on Next.js 16, LangChain, and PostgreSQL with pgvector.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.title}
            href={section.href}
            className="group block rounded-xl border border-border bg-card p-6 hover:border-primary/50 hover:shadow-lg transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                {section.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                  {section.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">{section.description}</p>
                <ul className="space-y-1">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <span className="text-sm text-primary hover:underline">{link.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 p-6 rounded-xl bg-muted/50 border border-border">
        <h3 className="text-lg font-semibold mb-2">Need help?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          If you run into issues or have questions, check the following resources:
        </p>
        <div className="flex flex-wrap gap-4">
          <a
            href="https://github.com/rejisterjack/rag-starter-kit/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            GitHub Issues
            <span className="sr-only">(opens in new tab)</span>
          </a>
          <a
            href="https://github.com/rejisterjack/rag-starter-kit"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Repository
            <span className="sr-only">(opens in new tab)</span>
          </a>
        </div>
      </div>
    </div>
  );
}
