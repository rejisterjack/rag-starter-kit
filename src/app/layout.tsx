import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Suspense } from 'react';
import { Navbar } from '@/components/navbar';
import { NonceScripts } from '@/components/nonce-scripts';
import { Providers } from '@/components/providers';
import { buildOrganizationJsonLd, buildWebSiteJsonLd, JsonLd } from '@/components/seo';
import { NavigationProgress } from '@/components/ui/navigation-progress';
import { Toaster } from '@/components/ui/toaster';
import { auth } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { SITE } from '@/lib/seo/content-registry';
import '@/styles/globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: true,
});

const siteUrl = SITE.url;

if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_APP_URL) {
  logger.warn(
    '[metadataBase] NEXT_PUBLIC_APP_URL is not set — falling back to default URL. Set this env var in production.'
  );
}

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} — Production-Ready RAG Chatbot`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
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
  ],
  authors: [{ name: 'Rupam Das' }],
  creator: 'Rupam Das',
  publisher: SITE.name,
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: SITE.name,
    title: `${SITE.name} — Production-Ready RAG Chatbot`,
    description: SITE.description,
    images: [
      {
        url: '/og',
        width: 1200,
        height: 630,
        alt: 'RAG Starter Kit — AI-Powered Document Search',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — Production-Ready RAG Chatbot`,
    description: SITE.description,
    images: ['/og'],
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
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  // PWA manifest
  manifest: '/manifest.json',
  // Apple specific PWA tags
  appleWebApp: {
    capable: true,
    title: 'RAG Starter Kit',
    statusBarStyle: 'default',
    startupImage: '/icons/icon-512x512.png',
  },
  // Application icons
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
    ],
    shortcut: [{ url: '/icons/icon-192x192.png', sizes: '192x192' }],
  },
  // Additional metadata
  category: 'technology',
  classification: 'Software Development',
  other: {
    'og:site_name': 'RAG Starter Kit',
    'twitter:domain': 'rag.rejisterjack.com',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#18181b' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  // Fetch the session server-side and seed SessionProvider so the navbar's
  // session-dependent markup renders identically on server and client
  // (prevents hydration mismatches, D-3)
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {/* Skip to content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2"
        >
          Skip to content
        </a>
        <Providers session={session}>
          <Suspense>
            <NavigationProgress />
          </Suspense>
          <div className="fixed inset-0 grid grid-rows-[auto_1fr] overflow-hidden">
            <Suspense>
              <Navbar />
            </Suspense>
            <main id="main-content" className="min-h-0 overflow-y-auto" tabIndex={-1}>
              {children}
            </main>
          </div>
          <Toaster />
        </Providers>
        <JsonLd data={buildWebSiteJsonLd()} />
        <JsonLd data={buildOrganizationJsonLd()} />
        {/* PWA Scripts & CSRF — client component, no Suspense needed */}
        <NonceScripts />
        {/* Vercel Analytics & Core Web Vitals */}
        <Suspense fallback={null}>
          <SpeedInsights />
          <Analytics />
        </Suspense>
      </body>
    </html>
  );
}
