import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/toaster';
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
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  width: 'device-width',
  initialScale: 1,
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans antialiased`}
      >
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <main className="flex-1">{children}</main>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
