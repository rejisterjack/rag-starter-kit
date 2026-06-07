import type { MetadataRoute } from 'next';

/**
 * Dynamic Sitemap
 *
 * Next.js automatically serves this at /sitemap.xml.
 * Add public pages here. Authenticated routes (chat, admin) are excluded.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */

// Docs pages: section roots get 'weekly', leaf pages get 'monthly'
const docsPages: Array<{ path: string; frequency: 'weekly' | 'monthly'; priority: number }> = [
  // Getting Started
  { path: '/docs/getting-started', frequency: 'weekly', priority: 0.8 },
  { path: '/docs/getting-started/installation', frequency: 'monthly', priority: 0.7 },
  { path: '/docs/getting-started/configuration', frequency: 'monthly', priority: 0.7 },
  { path: '/docs/getting-started/quick-start', frequency: 'monthly', priority: 0.7 },
  // API
  { path: '/docs/api', frequency: 'weekly', priority: 0.8 },
  { path: '/docs/api/chat', frequency: 'monthly', priority: 0.7 },
  { path: '/docs/api/documents', frequency: 'monthly', priority: 0.7 },
  { path: '/docs/api/embeddings', frequency: 'monthly', priority: 0.7 },
  // Guides
  { path: '/docs/guides', frequency: 'weekly', priority: 0.8 },
  { path: '/docs/guides/embedding-providers', frequency: 'monthly', priority: 0.7 },
  { path: '/docs/guides/llm-providers', frequency: 'monthly', priority: 0.7 },
  { path: '/docs/guides/deployment', frequency: 'monthly', priority: 0.7 },
  { path: '/docs/guides/authentication', frequency: 'monthly', priority: 0.7 },
  { path: '/docs/guides/chrome-extension', frequency: 'monthly', priority: 0.7 },
  // Reference
  { path: '/docs/reference', frequency: 'weekly', priority: 0.8 },
  { path: '/docs/reference/environment-variables', frequency: 'monthly', priority: 0.7 },
  { path: '/docs/reference/database-schema', frequency: 'monthly', priority: 0.7 },
  { path: '/docs/reference/rbac-permissions', frequency: 'monthly', priority: 0.7 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rag.rejisterjack.com';
  const now = new Date();

  const docsEntries: MetadataRoute.Sitemap = docsPages.map((page) => ({
    url: `${baseUrl}${page.path}`,
    lastModified: now,
    changeFrequency: page.frequency,
    priority: page.priority,
  }));

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/demo`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...docsEntries,
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];
}
