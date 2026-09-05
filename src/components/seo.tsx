/**
 * SEO Component
 *
 * Shared SEO helpers for consistent meta tags across pages.
 * Use `generateSEO` in page components to override default metadata,
 * and the JSON-LD builders below for structured data.
 *
 * Stack facts live in `src/lib/seo/content-registry.ts` — keep them in sync.
 */

import type { Metadata } from 'next';
import { getBreadcrumbTrail, SITE } from '@/lib/seo/content-registry';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  keywords?: string[];
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
}

const DEFAULT_KEYWORDS = [
  'RAG',
  'RAG starter kit',
  'AI chatbot boilerplate',
  'Next.js',
  'TypeScript',
  'pgvector',
  'PostgreSQL',
  'Prisma',
  'Vercel AI SDK',
  'retrieval-augmented generation',
  'document chatbot',
  'open source',
];

export function generateSEO({
  title = SITE.name,
  description = SITE.description,
  image = '/og',
  url = '/',
  type = 'website',
  keywords = DEFAULT_KEYWORDS,
  author = 'Rupam Das',
  publishedTime,
  modifiedTime,
}: SEOProps): Metadata {
  const fullUrl = `${SITE.url}${url}`;
  const fullImage = image.startsWith('http') ? image : `${SITE.url}${image}`;

  return {
    title,
    description,
    keywords,
    authors: [{ name: author }],
    creator: author,
    alternates: {
      canonical: fullUrl,
    },
    openGraph: {
      type,
      locale: 'en_US',
      url: fullUrl,
      siteName: SITE.name,
      title,
      description,
      images: [
        {
          url: fullImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [fullImage],
      creator: SITE.twitter,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

// =============================================================================
// JSON-LD Structured Data
// =============================================================================

type StructuredDataType =
  | 'WebSite'
  | 'WebPage'
  | 'SoftwareApplication'
  | 'Organization'
  | 'FAQPage'
  | 'BreadcrumbList'
  | 'HowTo'
  | 'TechArticle'
  | 'BlogPosting';

interface FAQItem {
  question: string;
  answer: string;
}

export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    description: SITE.description,
    url: SITE.url,
  };
}

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/icons/icon-512x512.png`,
    sameAs: [SITE.github],
  };
}

export function buildSoftwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE.name,
    description: SITE.description,
    url: SITE.url,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: SITE.name,
      url: SITE.url,
    },
  };
}

export function buildFAQJsonLd(faqs: FAQItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function buildBreadcrumbJsonLd(path: string) {
  const trail = getBreadcrumbTrail(path);
  if (trail.length < 2) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((entry, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: entry.title,
      item: `${SITE.url}${entry.path}`,
    })),
  };
}

export function buildTechArticleJsonLd(opts: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: opts.headline,
    description: opts.description,
    url: `${SITE.url}${opts.path}`,
    datePublished: opts.datePublished,
    ...(opts.dateModified && { dateModified: opts.dateModified }),
    author: { '@type': 'Person', name: 'Rupam Das' },
    publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
  };
}

export function buildBlogPostingJsonLd(opts: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
  keywords?: string[];
  wordCount?: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: opts.headline,
    description: opts.description,
    url: `${SITE.url}${opts.path}`,
    mainEntityOfPage: `${SITE.url}${opts.path}`,
    datePublished: opts.datePublished,
    ...(opts.dateModified && { dateModified: opts.dateModified }),
    ...(opts.keywords?.length && { keywords: opts.keywords.join(', ') }),
    ...(opts.wordCount && { wordCount: opts.wordCount }),
    author: { '@type': 'Person', name: 'Rupam Das' },
    publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    image: `${SITE.url}/og`,
  };
}

export function buildHowToJsonLd(opts: { name: string; description: string; steps: string[] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: opts.name,
    description: opts.description,
    step: opts.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text: s,
    })),
  };
}

/** Renders any JSON-LD object as a script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

/**
 * Backwards-compatible site-level structured data. New code should prefer the
 * `build*JsonLd` builders + `JsonLd` renderer for richer per-page markup.
 */
export function StructuredData({
  type = 'WebSite',
  name = SITE.name,
  description = SITE.description,
  url = SITE.url,
}: {
  type?: StructuredDataType;
  name?: string;
  description?: string;
  url?: string;
}) {
  const structuredData =
    type === 'SoftwareApplication'
      ? buildSoftwareApplicationJsonLd()
      : {
          '@context': 'https://schema.org',
          '@type': type,
          name,
          description,
          url,
        };

  return <JsonLd data={structuredData} />;
}
