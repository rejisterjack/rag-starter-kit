import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';
import { PWAScripts } from '@/components/pwa/pwa-scripts';
import { Navbar } from '@/components/navbar';
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

export const metadata: Metadata = {
  title: {
    default: 'RAG Chatbot',
    template: '%s | RAG Chatbot',
  },
  description:
    'A production-ready RAG (Retrieval-Augmented Generation) chatbot powered by Next.js, LangChain, and PostgreSQL pgvector.',
  keywords: [
    'RAG',
    'chatbot',
    'AI',
    'Next.js',
    'LangChain',
    'OpenAI',
    'pgvector',
    'PostgreSQL',
  ],
  authors: [{ name: 'Your Name' }],
  creator: 'Your Name',
  metadataBase: new URL(
    process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  ),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'RAG Chatbot',
    title: 'RAG Chatbot',
    description: 'A production-ready RAG chatbot powered by Next.js and LangChain.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RAG Chatbot',
    description: 'A production-ready RAG chatbot powered by Next.js and LangChain.',
  },
  robots: {
    index: true,
    follow: true,
  },
  // PWA manifest
  manifest: '/manifest.json',
  // Apple specific PWA tags
  appleWebApp: {
    capable: true,
    title: 'RAG Chatbot',
    statusBarStyle: 'default',
  },
  // Application icons
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192' },
      { url: '/icons/icon-512x512.png', sizes: '512x512' },
    ],
    apple: [
      { url: '/icons/icon-192x192.png', sizes: '192x192' },
    ],
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

export default function RootLayout({ children }: RootLayoutProps): React.ReactElement {
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
        
        {/* Prefetch offline page */}
        <link rel="prefetch" href="/offline" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans antialiased`}
        suppressHydrationWarning
      >
        <div className="vibrant-bg" />
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
          </div>
          <Toaster />
        </Providers>
        {/* PWA Scripts - Service Worker Registration */}
        <PWAScripts />
      </body>
    </html>
  );
}
