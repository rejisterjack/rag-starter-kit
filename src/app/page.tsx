'use client';

import { Github, Heart, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import {
  ChatSimulator,
  RagPipelineDiagram,
  TechStackMarquee,
} from '@/components/dynamic/landing-dynamic';
import {
  FeatureGrid,
  HeroSection,
  OpenSourceCTA,
  ScrollProgress,
  SetupAnimator,
} from '@/components/landing';
import { RAGBotWidget } from '@/components/widget';

export default function HomePage(): React.ReactElement {
  return (
    <div className="relative min-h-screen">
      {/* Scroll progress indicator */}
      <ScrollProgress />

      {/* Hero Section */}
      <HeroSection />

      {/* Setup Demo - Terminal typing animation */}
      <SetupAnimator />

      {/* RAG Pipeline Diagram - Interactive architecture explorer */}
      <RagPipelineDiagram />

      {/* Simulated Chat - Streaming demo */}
      <ChatSimulator />

      {/* Feature Grid - 9 production features */}
      <FeatureGrid />

      {/* Tech Stack Marquee - Infinite scrolling badges */}
      <TechStackMarquee />

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
                @rejisterjack
              </Link>
            </p>

            {/* Right - links */}
            <div className="flex items-center gap-4">
              <Link
                href="https://github.com/rejisterjack/rag-starter-kit"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="GitHub Repository"
              >
                <Github className="h-5 w-5" />
              </Link>
              <Link
                href="https://github.com/rejisterjack/rag-starter-kit/blob/main/CONTRIBUTING.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Contribute
              </Link>
              <Link
                href="/chat"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Demo
              </Link>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Powered by Next.js 15, LangChain.js, PostgreSQL + pgvector, and OpenRouter
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
