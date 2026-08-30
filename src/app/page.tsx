import { Github, Heart, MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  ChatSimulator,
  RagPipelineDiagram,
  TechStackMarquee,
} from '@/components/dynamic/landing-dynamic';
import {
  Differentiation,
  FeatureGrid,
  HeroSection,
  HowItWorks,
  OpenSourceCTA,
  ScrollProgress,
  SetupAnimator,
  Testimonials,
  UseCases,
  WhatsIncluded,
  WhoItsFor,
} from '@/components/landing';
import { buildFAQJsonLd, buildSoftwareApplicationJsonLd } from '@/components/seo';
import { RAGBotWidget } from '@/components/widget';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'RAG Starter Kit — Ship Your AI Document Chatbot This Weekend',
  description:
    'Open-source Next.js 16 starter kit for RAG chatbots. TypeScript-first, streaming SSE, pgvector, background jobs, and 2-minute deploy. No Python required.',
  openGraph: {
    title: 'RAG Starter Kit — Ship Your AI Document Chatbot This Weekend',
    description:
      'Open-source Next.js 16 starter kit for RAG chatbots with pgvector, streaming, and background jobs.',
    type: 'website',
  },
};

const HOME_FAQS = [
  {
    question: 'What is the RAG Starter Kit?',
    answer:
      'An open-source, MIT-licensed starter kit for building production RAG (Retrieval-Augmented Generation) chatbots. It is TypeScript-native — built on Next.js 16, PostgreSQL with pgvector, Prisma, and the Vercel AI SDK — and includes auth, multi-tenant workspaces, background ingestion jobs, and streaming responses out of the box.',
  },
  {
    question: 'Do I need Python or a separate vector database?',
    answer:
      'No. The entire pipeline runs in TypeScript on Next.js, and vector search uses pgvector — an extension for the PostgreSQL database you already run. There is no separate vector database service to deploy or pay for.',
  },
  {
    question: 'Is it really free to run?',
    answer:
      'Yes. The code is MIT-licensed and the default AI providers are free tiers: OpenRouter free models for chat and Google Gemini free tier (1,500 requests/day) for embeddings. Paid providers (OpenAI, Anthropic) are optional and swappable per workspace.',
  },
  {
    question: 'How long does it take to deploy?',
    answer:
      'About two minutes to deploy to Vercel. Clone, install dependencies, set DATABASE_URL and one free AI key, run migrations, and deploy. Local development starts with a single command.',
  },
  {
    question: 'What document formats can it ingest?',
    answer:
      'PDF, DOCX, TXT, and Markdown via the UI, REST API, or webhook. Documents are parsed, chunked, embedded, and stored in pgvector through Inngest background jobs, with OCR support for scanned images.',
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSoftwareApplicationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFAQJsonLd(HOME_FAQS)) }}
      />
      <div className="vibrant-bg" />
      {/* Scroll progress indicator */}
      <ScrollProgress />

      {/* Hero Section */}
      <HeroSection />

      {/* How It Works - 3 step pipeline explainer */}
      <HowItWorks />

      {/* Setup Demo - Terminal typing animation */}
      <SetupAnimator />

      {/* Who Is This For - Personas */}
      <WhoItsFor />

      {/* Differentiation - vs Python/LangChain */}
      <Differentiation />

      {/* RAG Pipeline Diagram - Interactive architecture explorer */}
      <Suspense fallback={<div className="h-96" />}>
        <RagPipelineDiagram />
      </Suspense>

      {/* Use Case Stories */}
      <UseCases />

      {/* Simulated Chat - Streaming demo */}
      <Suspense fallback={<div className="h-96" />}>
        <ChatSimulator />
      </Suspense>

      {/* Feature Grid - 9 production features */}
      <FeatureGrid />

      {/* What's Included - Checklist */}
      <WhatsIncluded />

      {/* Tech Stack Marquee - Infinite scrolling badges */}
      <Suspense fallback={<div className="h-64" />}>
        <TechStackMarquee />
      </Suspense>

      {/* Testimonials & Showcase */}
      <Testimonials />

      {/* Open Source CTA - GitHub celebration + deploy badges */}
      <OpenSourceCTA />

      {/* RAG Bot Widget */}
      <RAGBotWidget />

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              <span className="font-semibold text-foreground text-lg">RAG Starter Kit</span>
            </div>

            {/* Center - license + love */}
            <p className="text-sm text-muted-foreground text-center">
              MIT Licensed — Built with <Heart className="inline h-3.5 w-3.5 text-red-500 mx-1" />{' '}
              by{' '}
              <Link
                href="https://github.com/rejisterjack"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-primary transition-colors"
              >
                @rejisterjack <span className="sr-only">(opens in new tab)</span>
              </Link>
            </p>

            {/* Right - links */}
            <div className="flex items-center gap-4">
              <Link
                href="https://github.com/rejisterjack/rag-starter-kit"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="GitHub Repository (opens in new tab)"
              >
                <Github className="h-5 w-5" />
              </Link>
              <Link
                href="https://github.com/rejisterjack/rag-starter-kit/blob/main/CONTRIBUTING.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Contribute <span className="sr-only">(opens in new tab)</span>
              </Link>
              <Link
                href="/demo"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Demo
              </Link>
              <Link
                href="/docs"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                API Docs
              </Link>
              <Link
                href="https://github.com/rejisterjack/rag-starter-kit/blob/main/CHANGELOG.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Changelog <span className="sr-only">(opens in new tab)</span>
              </Link>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Powered by Next.js 16, LangChain.js, PostgreSQL, pgvector, and OpenRouter
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>TypeScript</span>
              <span className="text-border">|</span>
              <span>Self-hosted</span>
              <span className="text-border">|</span>
              <span>$0 to run</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
