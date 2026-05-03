/**
 * Dynamic Landing Page Components
 *
 * These heavy components use framer-motion and are lazy-loaded
 * to reduce the initial bundle size of the landing page.
 */

'use client';

import dynamic from 'next/dynamic';

// RagPipelineDiagram - Interactive architecture explorer with framer-motion animations
const RagPipelineDiagram = dynamic(
  () => import('@/components/landing/rag-pipeline-diagram').then((mod) => mod.RagPipelineDiagram),
  {
    loading: () => (
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="h-16 w-96 bg-muted/50 animate-pulse rounded-lg mx-auto mb-16" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <div
                key={`pipeline-stage-${n}`}
                className="h-40 bg-muted/50 animate-pulse rounded-2xl"
              />
            ))}
          </div>
          <div className="mt-8 lg:mt-12 h-40 bg-muted/50 animate-pulse rounded-3xl" />
        </div>
      </section>
    ),
    ssr: false,
  }
);

// ChatSimulator - Streaming demo with framer-motion animations and intersection observer
const ChatSimulator = dynamic(
  () => import('@/components/landing/chat-simulator').then((mod) => mod.ChatSimulator),
  {
    loading: () => (
      <section className="py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="h-16 w-72 bg-muted/50 animate-pulse rounded-lg mx-auto mb-12" />
            <div className="bg-muted/50 animate-pulse rounded-3xl min-h-[500px]" />
          </div>
        </div>
      </section>
    ),
    ssr: false,
  }
);

// TechStackMarquee - Infinite scrolling badges
const TechStackMarquee = dynamic(
  () => import('@/components/landing/tech-stack-marquee').then((mod) => mod.TechStackMarquee),
  {
    loading: () => (
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-12">
          <div className="h-12 w-64 bg-muted/50 animate-pulse rounded-lg mx-auto" />
        </div>
        <div className="space-y-4">
          <div className="h-12 bg-muted/50 animate-pulse rounded-full mx-20" />
          <div className="h-12 bg-muted/50 animate-pulse rounded-full mx-20" />
        </div>
      </section>
    ),
    ssr: false,
  }
);

export { ChatSimulator, RagPipelineDiagram, TechStackMarquee };
