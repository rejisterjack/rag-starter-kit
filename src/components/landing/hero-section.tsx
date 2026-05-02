'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Github, Sparkles, Terminal } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
};

export function HeroSection(): React.ReactElement {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-20 pb-12 lg:pt-28 lg:pb-20">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <motion.div
          className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(var(--primary) / 0.25), transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -20, 30, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(320 100% 60% / 0.2), transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{
            x: [0, -25, 20, 0],
            y: [0, 20, -15, 0],
            scale: [1, 0.9, 1.05, 1],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: -5,
          }}
        />
        <motion.div
          className="absolute top-[40%] right-[30%] w-[300px] h-[300px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(180 100% 50% / 0.15), transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{
            x: [0, 15, -10, 0],
            y: [0, -10, 15, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: -8,
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
        <motion.div
          className="text-center max-w-4xl mx-auto"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          {/* Badge */}
          <motion.div variants={fadeInUp} className="mb-8 flex justify-center">
            <Link
              href="https://github.com/rejisterjack/rag-starter-kit"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full glass-light px-4 py-2 text-sm font-medium text-primary hover:scale-105 transition-transform duration-300"
            >
              <Sparkles className="h-4 w-4" />
              <span>Open Source on GitHub</span>
              <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-xs">
                MIT License
              </span>
            </Link>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeInUp}
            className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl xl:text-8xl"
          >
            The <span className="text-gradient">TypeScript-Native</span>
            <br />
            RAG Platform
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            variants={fadeInUp}
            className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-muted-foreground leading-relaxed"
          >
            Production-ready. Self-hostable.{' '}
            <span className="text-foreground font-medium">Zero API costs.</span>
            <br className="hidden sm:block" />
            Deploy an AI document chatbot in minutes — no Python, no credit card, no compromises.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeInUp}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              asChild
              size="lg"
              className="h-14 px-8 text-base rounded-full bg-primary hover:bg-primary/90 hover:scale-105 transition-all duration-300 shadow-lg shadow-primary/25"
            >
              <Link
                href="https://github.com/rejisterjack/rag-starter-kit"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="mr-2 h-5 w-5" />
                Clone & Deploy
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-14 px-8 text-base rounded-full glass-light hover:bg-primary/5 hover:border-primary/30 transition-all duration-300"
            >
              <Link href="/chat">
                <Terminal className="mr-2 h-5 w-5" />
                Try Live Demo
              </Link>
            </Button>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            variants={fadeInUp}
            className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 border-y border-border/50 py-8"
          >
            {[
              { value: '2 min', label: 'Setup time' },
              { value: '$0', label: 'To run' },
              { value: '100%', label: 'TypeScript' },
              { value: 'MIT', label: 'License' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold text-foreground sm:text-3xl">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Floating preview cards */}
        <div className="relative mt-12 max-w-5xl mx-auto">
          <motion.div
            className="glass-panel rounded-2xl p-4 sm:p-6 relative z-10"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
              </div>
              <span className="text-xs text-muted-foreground font-mono ml-2">rag-starter-kit</span>
            </div>
            <div className="font-mono text-sm space-y-1 text-muted-foreground">
              <p>
                <span className="text-green-500">$</span> git clone
                https://github.com/rejisterjack/rag-starter-kit.git
              </p>
              <p>
                <span className="text-green-500">$</span> cd rag-starter-kit && cp .env.example .env
              </p>
              <p>
                <span className="text-green-500">$</span> docker compose up
              </p>
              <p className="text-foreground">{'>'} Starting PostgreSQL, Redis, MinIO, Inngest...</p>
              <p className="text-primary font-medium">{'>'} Ready at http://localhost:3000</p>
            </div>
          </motion.div>

          {/* Decorative floating elements */}
          <motion.div
            className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 glass-panel rounded-xl px-4 py-2 z-20"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 1.0, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-foreground">Streaming SSE</span>
            </div>
          </motion.div>

          <motion.div
            className="absolute -bottom-4 -left-4 sm:-bottom-6 sm:-left-6 glass-panel rounded-xl px-4 py-2 z-20"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 1.2, duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs font-medium text-foreground">pgvector Ready</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
