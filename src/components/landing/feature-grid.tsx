'use client';

import { motion } from 'framer-motion';
import { Bot, Code2, Globe, Mic, Radio, Shield, Upload, Users, Zap } from 'lucide-react';
import { useState } from 'react';

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  highlight: string;
  tags: string[];
}

const features: Feature[] = [
  {
    icon: Bot,
    title: 'Intelligent RAG',
    description:
      'Context-aware responses using LangChain.js and pgvector. Hybrid search combines vector similarity with keyword matching for unprecedented accuracy.',
    highlight: 'Hybrid Search',
    tags: ['LangChain.js', 'pgvector', 'OpenRouter'],
  },
  {
    icon: Upload,
    title: 'Seamless Ingestion',
    description:
      'Upload PDFs, Word docs, Markdown, and text files. Background processing via Inngest handles large documents without blocking the UI.',
    highlight: 'Background Jobs',
    tags: ['Inngest', 'MinIO/S3', 'Auto-chunking'],
  },
  {
    icon: Zap,
    title: 'Ultra-low Latency',
    description:
      'Lightning-fast token streaming via Server-Sent Events. Responses appear in real-time with sub-second first token latency.',
    highlight: 'SSE Streaming',
    tags: ['Real-time', 'WebSocket', 'Presence'],
  },
  {
    icon: Users,
    title: 'Multi-user Workspaces',
    description:
      'Collaborative workspaces with typing indicators, presence tracking, and role-based access. Built for teams from day one.',
    highlight: 'Real-time Collab',
    tags: ['WebSocket', 'SSE', 'RBAC'],
  },
  {
    icon: Mic,
    title: 'Voice I/O',
    description:
      'Speech-to-text via Web Speech API + Whisper. Text-to-speech synthesis. Wake word detection ("Hey RAG") for hands-free operation.',
    highlight: 'Voice Ready',
    tags: ['Web Speech', 'Whisper', 'VAD'],
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description:
      'NextAuth.js v5 with OAuth (GitHub, Google), audit logging, rate limiting via Upstash Redis, and row-level database isolation.',
    highlight: 'Audit Logging',
    tags: ['NextAuth', 'Redis', 'Zod'],
  },
  {
    icon: Code2,
    title: '100% TypeScript',
    description:
      'No Python, no context switching. Next.js 15 App Router, React 19, Tailwind CSS 4, shadcn/ui — all strictly typed end-to-end.',
    highlight: 'Type-safe',
    tags: ['Next.js 15', 'React 19', 'Tailwind 4'],
  },
  {
    icon: Globe,
    title: 'PWA Support',
    description:
      'Install as a native app on any device. Offline support, push notifications, and responsive design across all breakpoints.',
    highlight: 'Native Feel',
    tags: ['Service Worker', 'Installable', 'Offline'],
  },
  {
    icon: Radio,
    title: 'Observability',
    description:
      'PostHog + Plausible analytics, Pino structured logging, OpenTelemetry traces. Know exactly what your AI is doing.',
    highlight: 'Full Visibility',
    tags: ['PostHog', 'Plausible', 'OpenTelemetry'],
  },
];

export function FeatureGrid(): React.ReactElement {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section className="py-24 lg:py-32 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Everything You Need, <span className="text-gradient">Nothing You Don&apos;t</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Production infrastructure already wired in. Auth, storage, queues, analytics — it&apos;s
            the project you&apos;d spend three weeks building.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="group relative glass-panel rounded-2xl p-6 cursor-default"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.06 }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              whileHover={{
                y: -6,
                scale: 1.02,
                transition: { duration: 0.25, ease: 'easeOut' },
              }}
            >
              {/* Glow effect on hover */}
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  background: `radial-gradient(300px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), hsl(var(--primary) / 0.08), transparent 40%)`,
                }}
                animate={{
                  opacity: hoveredIndex === index ? 1 : 0,
                }}
                transition={{ duration: 0.3 }}
              />

              {/* Icon */}
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                <feature.icon className="h-6 w-6" />
              </div>

              {/* Title + highlight badge */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {feature.highlight}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {feature.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {feature.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] px-2 py-1 rounded-md bg-muted text-muted-foreground font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
