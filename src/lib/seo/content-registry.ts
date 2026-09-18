/**
 * Content Registry — single source of truth for all indexable surfaces.
 *
 * Feeds: sitemap.ts, llms.txt, llms-full.txt, feed.xml, breadcrumbs, and docs nav.
 * Keep entries accurate — AI crawlers and search engines ingest this directly.
 */

export const SITE = {
  name: 'RAG Starter Kit',
  url: process.env.NEXT_PUBLIC_APP_URL || 'https://rag.rejisterjack.com',
  tagline: 'Ship a production-grade AI document chatbot this weekend',
  description:
    'Open-source Next.js starter kit for RAG chatbots. TypeScript-first, streaming SSE, pgvector, background jobs, and 2-minute deploy. No Python required.',
  github: 'https://github.com/rejisterjack/rag-starter-kit',
  twitter: '@ragstarterkit',
  license: 'MIT',
} as const;

/** Accurate stack facts — keep in sync with package.json */
export const STACK_FACTS = [
  'Next.js 16 (App Router, standalone output, PWA)',
  'React 19 + TypeScript 5.8',
  'PostgreSQL 16+ with pgvector (native vector search, no separate vector DB)',
  'Prisma 7 ORM',
  'Vercel AI SDK (streaming SSE responses)',
  'Providers: OpenRouter (free models), Google Gemini, OpenAI, Anthropic, Ollama',
  'Embeddings: Google Gemini free tier (1,500 req/day) or any OpenAI-compatible API',
  'Inngest background jobs (document processing pipelines)',
  'NextAuth v5 (credentials, OAuth, MFA, SAML SSO)',
  'Tailwind CSS 4 + shadcn/ui',
  'PostHog analytics, Sentry error tracking',
] as const;

export interface RegistryEntry {
  path: string;
  title: string;
  description: string;
  /** ISO date of last meaningful content change */
  lastModified: string;
  section: 'landing' | 'docs' | 'blog' | 'reference';
  changeFrequency: 'daily' | 'weekly' | 'monthly';
  priority: number;
  /** Navigation parent path, for breadcrumbs */
  parent?: string;
}

export const LANDING_PAGES: RegistryEntry[] = [
  {
    path: '/',
    title: 'RAG Starter Kit — Ship Your AI Document Chatbot This Weekend',
    description:
      'Open-source Next.js starter kit for RAG chatbots. TypeScript-first, streaming SSE, pgvector, background jobs, and 2-minute deploy. No Python required.',
    lastModified: '2026-08-30',
    section: 'landing',
    changeFrequency: 'weekly',
    priority: 1.0,
  },
  {
    path: '/pricing',
    title: 'Pricing — Free Forever, MIT Licensed',
    description:
      'RAG Starter Kit is free and open-source forever under the MIT license. Self-host with zero cost using free-tier AI providers.',
    lastModified: '2026-08-30',
    section: 'landing',
    changeFrequency: 'monthly',
    priority: 0.6,
  },
  {
    path: '/demo',
    title: 'Live Demo — Try the RAG Chatbot',
    description:
      'Try the RAG Starter Kit live. Upload documents and chat with streaming AI responses. No signup required.',
    lastModified: '2026-08-30',
    section: 'landing',
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  {
    path: '/blog',
    title: 'Blog — RAG Engineering Guides',
    description:
      'Practical guides on building production RAG systems: pgvector, retrieval quality, evaluation, and deployment.',
    lastModified: '2026-08-30',
    section: 'blog',
    changeFrequency: 'weekly',
    priority: 0.8,
  },
  {
    path: '/docs',
    title: 'Documentation',
    description:
      'Everything you need to install, configure, and deploy your AI document chatbot with the RAG Starter Kit.',
    lastModified: '2026-08-30',
    section: 'docs',
    changeFrequency: 'weekly',
    priority: 0.9,
  },
];

export const DOCS_PAGES: RegistryEntry[] = [
  // Getting Started
  {
    path: '/docs/getting-started',
    title: 'Getting Started',
    description: 'Install, configure, and send your first chat message in under five minutes.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'weekly',
    priority: 0.8,
    parent: '/docs',
  },
  {
    path: '/docs/getting-started/installation',
    title: 'Installation',
    description:
      'Step-by-step installation for the RAG Starter Kit including prerequisites and database setup.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/docs/getting-started',
  },
  {
    path: '/docs/getting-started/configuration',
    title: 'Configuration',
    description: 'All environment variables and configuration options for the RAG Starter Kit.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/docs/getting-started',
  },
  {
    path: '/docs/getting-started/quick-start',
    title: 'Quick Start',
    description: 'Get a working RAG chatbot in 5 minutes with this step-by-step quick start guide.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/docs/getting-started',
  },
  // API
  {
    path: '/docs/api',
    title: 'API Reference',
    description:
      'Complete REST API reference for chat, document ingestion, embeddings, and workspaces.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'weekly',
    priority: 0.8,
    parent: '/docs',
  },
  {
    path: '/docs/api/chat',
    title: 'Chat API',
    description:
      'Chat endpoint reference: streaming SSE, request/response schemas, and parameters.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/docs/api',
  },
  {
    path: '/docs/api/documents',
    title: 'Documents API',
    description: 'Document ingestion API: upload, list, delete, and webhook ingestion endpoints.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/docs/api',
  },
  {
    path: '/docs/api/embeddings',
    title: 'Embeddings API',
    description: 'Embedding endpoint reference: providers, dimensions, and batch limits.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/docs/api',
  },
  // Guides
  {
    path: '/docs/guides',
    title: 'Guides',
    description: 'Deep-dive guides for RAG Starter Kit providers, deployment, and security.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'weekly',
    priority: 0.8,
    parent: '/docs',
  },
  {
    path: '/docs/guides/embedding-providers',
    title: 'Embedding Providers',
    description: 'How to configure and switch embedding providers (Gemini, OpenAI, Ollama).',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/docs/guides',
  },
  {
    path: '/docs/guides/llm-providers',
    title: 'LLM Providers',
    description: 'How to configure LLM providers: OpenRouter, Gemini, OpenAI, Anthropic, Ollama.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/docs/guides',
  },
  {
    path: '/docs/guides/deployment',
    title: 'Deployment',
    description: 'Deploy the RAG Starter Kit to Vercel, Railway, Docker, or any Node host.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/docs/guides',
  },
  {
    path: '/docs/guides/authentication',
    title: 'Authentication',
    description: 'Auth setup: credentials, OAuth, MFA, and SAML SSO configuration.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/docs/guides',
  },
  {
    path: '/docs/guides/chrome-extension',
    title: 'Chrome Extension',
    description: 'Install and use the bundled Chrome extension for inline RAG chat.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/docs/guides',
  },
  // Reference
  {
    path: '/docs/reference',
    title: 'Reference',
    description: 'Reference material: environment variables, database schema, RBAC permissions.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'weekly',
    priority: 0.8,
    parent: '/docs',
  },
  {
    path: '/docs/reference/environment-variables',
    title: 'Environment Variables',
    description: 'Complete list of environment variables with defaults and descriptions.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/docs/reference',
  },
  {
    path: '/docs/reference/database-schema',
    title: 'Database Schema',
    description: 'Prisma schema reference: all models, relations, and pgvector columns.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/docs/reference',
  },
  {
    path: '/docs/reference/rbac-permissions',
    title: 'RBAC Permissions',
    description: 'Role-based access control reference: roles, permissions, and inheritance.',
    lastModified: '2026-08-25',
    section: 'docs',
    changeFrequency: 'monthly',
    priority: 0.7,
    parent: '/docs/reference',
  },
];

/** All indexable pages, merged */
export function getAllPages(): RegistryEntry[] {
  return [...LANDING_PAGES, ...DOCS_PAGES];
}

/** Look up a page by path */
export function getEntry(path: string): RegistryEntry | undefined {
  return getAllPages().find((p) => p.path === path);
}

/** Build a breadcrumb trail (root-first) by walking parents */
export function getBreadcrumbTrail(path: string): RegistryEntry[] {
  const trail: RegistryEntry[] = [];
  const seen = new Set<string>();
  let current = getEntry(path);
  while (current && !seen.has(current.path)) {
    seen.add(current.path);
    trail.unshift(current);
    current = current.parent ? getEntry(current.parent) : undefined;
  }
  return trail;
}
