import type { MetadataRoute } from 'next';
import { getAllPages, SITE } from '@/lib/seo/content-registry';

/**
 * Dynamic Sitemap
 *
 * Next.js automatically serves this at /sitemap.xml.
 * Driven by the content registry so sitemap, llms.txt, and RSS stay consistent.
 * Authenticated routes (chat, admin) are excluded.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return getAllPages().map((page) => ({
    url: `${SITE.url}${page.path}`,
    lastModified: new Date(page.lastModified),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
