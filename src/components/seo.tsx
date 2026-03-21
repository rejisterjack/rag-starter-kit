/**
 * SEO Component
 * 
 * Shared SEO component for consistent meta tags across pages.
 * Use this in page components to override default metadata.
 */

import type { Metadata } from 'next';

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

export function generateSEO({
  title = 'RAG Starter Kit',
  description = 'A production-ready RAG (Retrieval-Augmented Generation) chatbot powered by Next.js, LangChain, and PostgreSQL pgvector.',
  image = '/og-image.png',
  url = '/',
  type = 'website',
  keywords = ['RAG', 'chatbot', 'AI', 'Next.js', 'LangChain', 'OpenAI', 'pgvector', 'PostgreSQL'],
  author = 'RAG Starter Kit Team',
  publishedTime,
  modifiedTime,
}: SEOProps): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rag-starter-kit.vercel.app';
  const fullUrl = `${siteUrl}${url}`;
  const fullImage = image.startsWith('http') ? image : `${siteUrl}${image}`;

  return {
    title,
    description,
    keywords,
    authors: [{ name: author }],
    creator: author,
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: url,
    },
    openGraph: {
      type,
      locale: 'en_US',
      url: fullUrl,
      siteName: 'RAG Starter Kit',
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
      creator: '@ragstarterkit',
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

/**
 * JSON-LD Structured Data for rich snippets
 */
export function StructuredData({
  type = 'WebSite',
  name = 'RAG Starter Kit',
  description = 'A production-ready RAG chatbot boilerplate',
  url = 'https://rag-starter-kit.vercel.app',
}: {
  type?: 'WebSite' | 'WebPage' | 'SoftwareApplication';
  name?: string;
  description?: string;
  url?: string;
}) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    description,
    url,
    ...(type === 'SoftwareApplication' && {
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      author: {
        '@type': 'Organization',
        name: 'RAG Starter Kit Team',
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData),
      }}
    />
  );
}
