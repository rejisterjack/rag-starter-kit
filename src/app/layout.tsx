import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import { Navbar } from '@/components/navbar';
import { Providers } from '@/components/providers';
import { PWAScripts } from '@/components/pwa/pwa-scripts';
import { StructuredData } from '@/components/seo';
import { Toaster } from '@/components/ui/toaster';
import { CsrfTokenScript } from '@/lib/security/csrf';
import '@/styles/globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://rag-starter-kit.vercel.app';

export const metadata: Metadata = {
  title: {
    default: 'RAG Starter Kit - Production-Ready RAG Chatbot',
    template: '%s | RAG Starter Kit',
  },
  description:
    'A production-ready RAG (Retrieval-Augmented Generation) chatbot boilerplate powered by Next.js 15, LangChain, and PostgreSQL pgvector. Build AI-powered document chatbots in minutes.',
  keywords: [
    'RAG',
    'chatbot',
    'AI',
    'Next.js',
    'LangChain',
    'OpenAI',
    'pgvector',
    'PostgreSQL',
    'retrieval-augmented generation',
    'document chatbot',
    'AI boilerplate',
  ],
  authors: [{ name: 'RAG Starter Kit Team' }],
  creator: 'RAG Starter Kit Team',
  publisher: 'RAG Starter Kit',
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'RAG Starter Kit',
    title: 'RAG Starter Kit - Production-Ready RAG Chatbot',
    description:
      'Build AI-powered document chatbots with Next.js, LangChain, and PostgreSQL pgvector.',
    images: [
      {
        url: '/og',
        width: 1200,
        height: 630,
        alt: 'RAG Starter Kit - Production-Ready RAG Chatbot Boilerplate',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RAG Starter Kit - Production-Ready RAG Chatbot',
    description:
      'Build AI-powered document chatbots with Next.js, LangChain, and PostgreSQL pgvector.',
    images: ['/og'],
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
    'twitter:domain': 'rag-starter-kit.vercel.app',
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

export default async function RootLayout({
  children,
}: RootLayoutProps): Promise<React.ReactElement> {
  // Get nonce from headers (set by middleware)
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? '';

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA meta tags for iOS */}
        <meta name="application-name" content="RAG Chatbot" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="RAG Chat" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#18181b" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* PWA icons for iOS */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/icon-152x152.png" />

        {/* Splash screen images for iOS */}
        <link rel="apple-touch-startup-image" href="/icons/icon-512x512.png" />

        {/* KaTeX CSS for LaTeX math rendering */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
          integrity="sha384-nB0miv6/jRmo5OUTIL0mKZsUQSA/1kzMuoHIOXPb6BjSiW4zuv9mqSTJBGdQsGN"
          crossOrigin="anonymous"
        />

        {/* Prefetch offline page */}
        <link rel="prefetch" href="/offline" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {/* Skip to content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2"
        >
          Skip to content
        </a>
        <div className="vibrant-bg" />
        <Providers>
          <div className="fixed inset-0 grid grid-rows-[auto_1fr] overflow-hidden">
            <Navbar />
            <main id="main-content" className="min-h-0 overflow-y-auto" tabIndex={-1}>
              {children}
            </main>
          </div>
          <Toaster />
        </Providers>
        <StructuredData />
        {/* PWA Scripts - Service Worker Registration */}
        <PWAScripts nonce={nonce} />
        {/* CSRF Token Initialization */}
        <CsrfTokenScript nonce={nonce} />
      </body>
    </html>
  );
}
