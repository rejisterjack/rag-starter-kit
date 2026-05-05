'use client';

import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Bot, Code2, Globe, Mic, Radio, Shield, Upload, Users, Zap } from 'lucide-react';
import { useRef } from 'react';

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
    tags: ['Inngest', 'Cloudinary', 'Auto-chunking'],
  },
  {
    icon: Zap,
    title: 'Ultra-low Latency',
    description:
      'Lightning-fast token streaming via Server-Sent Events. Responses appear in real-time with sub-second first token latency.',
    highlight: 'SSE Streaming',
    tags: ['Real-time', 'SSE', 'Ably'],
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
      'Plausible analytics, Pino structured logging, OpenTelemetry traces. Know exactly what your AI is doing.',
    highlight: 'Full Visibility',
    tags: ['Plausible', 'OpenTelemetry', 'Pino'],
  },
];

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const smoothMouseX = useSpring(mouseX, { stiffness: 100, damping: 20 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 100, damping: 20 });

  const rotateX = useTransform(smoothMouseY, [-0.5, 0.5], [10, -10]);
  const rotateY = useTransform(smoothMouseX, [-0.5, 0.5], [-10, 10]);

  const spotlightX = useTransform(mouseX, [-0.5, 0.5], ['0%', '100%']);
  const spotlightY = useTransform(mouseY, [-0.5, 0.5], ['0%', '100%']);

  const background = useMotionTemplate`radial-gradient(400px circle at ${spotlightX} ${spotlightY}, hsl(var(--primary) / 0.15), transparent 50%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const Icon = feature.icon;

  return (
    <motion.div
      ref={cardRef}
      className="group relative h-full [perspective:1000px] cursor-default"
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="glass-panel relative h-full rounded-2xl p-6 sm:p-8 overflow-hidden transition-colors duration-500 border border-border/50 group-hover:border-primary/30"
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <motion.div
          className="absolute inset-0 z-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{ background }}
        />

        <div className="relative z-10 h-full flex flex-col [transform:translateZ(20px)]">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 transition-all duration-300 shadow-[0_0_0_0_hsl(var(--primary)/0)] group-hover:shadow-[0_0_20px_0_hsl(var(--primary)/40)]">
            <Icon className="h-7 w-7" />
          </div>

          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h3 className="text-xl font-bold text-foreground tracking-tight">{feature.title}</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">
              {feature.highlight}
            </span>
          </div>

          <p className="text-muted-foreground leading-relaxed flex-grow">{feature.description}</p>

          <div className="flex flex-wrap gap-2 mt-6">
            {feature.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-md bg-muted/50 border border-border/50 text-muted-foreground font-medium group-hover:border-primary/20 transition-colors"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function FeatureGrid(): React.ReactElement {
  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--background)),hsl(var(--background))_80%)] -z-10" />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary mb-6 text-sm font-medium border border-primary/20">
            <Zap className="h-4 w-4" />
            <span>Infrastructure Included</span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl mb-6">
            Everything You Need,
            <br />
            <span className="text-gradient">Nothing You Don&apos;t</span>
          </h2>
          <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Production infrastructure already wired in. Auth, storage, queues, analytics — it&apos;s
            the project you&apos;d spend three weeks building.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
