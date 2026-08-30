import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo/content-registry';

const DISALLOW = ['/api/', '/admin/', '/chat/', '/_next/', '/login', '/register'];
const ALLOW = ['/', '/docs/', '/blog/', '/llms.txt'];

// AI crawlers we explicitly welcome for search, retrieval, and training.
const AI_CRAWLERS = [
  'GPTBot', // OpenAI training
  'OAI-SearchBot', // ChatGPT Search
  'ChatGPT-User', // ChatGPT live retrieval
  'ClaudeBot', // Anthropic training
  'Claude-Web', // Anthropic live retrieval
  'anthropic-ai', // Anthropic user-triggered fetches
  'PerplexityBot', // Perplexity indexing
  'Perplexity-User', // Perplexity live fetch
  'Google-Extended', // Gemini training
  'Googlebot', // Google Search + AI Overviews
  'Applebot-Extended', // Apple Intelligence
  'CCBot', // Common Crawl (feeds many open datasets)
  'Bytespider', // ByteDance
  'cohere-ai',
  'Meta-ExternalAgent',
] as const;

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE.url;
  const rules: MetadataRoute.Robots['rules'] = [
    ...AI_CRAWLERS.map((userAgent) => ({
      userAgent,
      allow: [...ALLOW],
      disallow: [...DISALLOW],
    })),
    {
      userAgent: '*',
      allow: '/',
      disallow: [...DISALLOW],
    },
  ];
  return {
    rules,
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
