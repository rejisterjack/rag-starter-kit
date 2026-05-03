'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Code2,
  ExternalLink,
  GitFork,
  Github,
  Heart,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GitHubStats } from './github-stats';

const contributionWays = [
  {
    icon: Star,
    title: 'Star the Repo',
    description: 'Show your support and help others discover the project.',
    action: 'Star on GitHub',
    href: 'https://github.com/rejisterjack/rag-starter-kit',
  },
  {
    icon: GitFork,
    title: 'Fork & Build',
    description: 'Fork it, customize it for your use case, and ship to production.',
    action: 'Fork Repository',
    href: 'https://github.com/rejisterjack/rag-starter-kit/fork',
  },
  {
    icon: Code2,
    title: 'Contribute Code',
    description: 'Submit PRs for features, fixes, or improvements. All contributions welcome.',
    action: 'See Contributing Guide',
    href: 'https://github.com/rejisterjack/rag-starter-kit/blob/main/CONTRIBUTING.md',
  },
  {
    icon: BookOpen,
    title: 'Share Knowledge',
    description: 'Write about your experience. Help others learn production RAG patterns.',
    action: 'Read the Docs',
    href: 'https://github.com/rejisterjack/rag-starter-kit#readme',
  },
];

export function OpenSourceCTA(): React.ReactElement {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      {/* Background ambient light */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,hsl(var(--primary)/0.05),transparent_50%)] pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main CTA Card */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-3xl p-8 sm:p-16 lg:p-20 text-center mb-24 shadow-[0_0_80px_-20px_rgba(0,0,0,0.5)]"
        >
          {/* Animated Background Gradients inside the card */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <motion.div
              className="absolute top-[-50%] left-[-10%] w-[80%] h-[150%] rounded-full opacity-30"
              style={{
                background: 'radial-gradient(circle, hsl(var(--primary)), transparent 60%)',
                filter: 'blur(80px)',
              }}
              animate={{
                transform: [
                  'translate(0%, 0%) rotate(0deg)',
                  'translate(5%, 5%) rotate(5deg)',
                  'translate(0%, 0%) rotate(0deg)',
                ],
              }}
              transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute bottom-[-50%] right-[-10%] w-[70%] h-[130%] rounded-full opacity-20"
              style={{
                background: 'radial-gradient(circle, hsl(320 100% 60%), transparent 60%)',
                filter: 'blur(100px)',
              }}
              animate={{
                transform: [
                  'translate(0%, 0%) rotate(0deg)',
                  'translate(-5%, -5%) rotate(-5deg)',
                  'translate(0%, 0%) rotate(0deg)',
                ],
              }}
              transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: -5 }}
            />
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
          </div>

          <div className="relative z-10">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary mb-8 shadow-[0_0_20px_hsl(var(--primary)/0.2)]"
            >
              <Heart className="h-4 w-4 text-red-400 animate-pulse" />
              <span>MIT Licensed — Free Forever</span>
            </motion.div>

            <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-7xl mb-6 leading-tight">
              Built by Developers,
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white/60 to-white/30">
                for Developers
              </span>
            </h2>

            <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
              This is not a SaaS. There is no pricing page. No vendor lock-in. No central server.
              Clone it, own it, deploy it. Your data never leaves your infrastructure.
            </p>

            {/* GitHub Stats */}
            <div className="flex justify-center mb-12">
              <div className="glass-panel border-white/10 bg-white/5 inline-block rounded-2xl p-2 shadow-2xl">
                <GitHubStats />
              </div>
            </div>

            {/* Deploy buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-12">
              <Button
                asChild
                size="lg"
                className="group relative h-14 px-8 text-base rounded-full bg-primary text-primary-foreground hover:scale-105 transition-all duration-300 shadow-[0_0_40px_-10px_hsl(var(--primary))] overflow-hidden interactive"
              >
                <Link
                  href="https://github.com/rejisterjack/rag-starter-kit"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)] -translate-x-[150%] group-hover:animate-[shimmer_1.5s_infinite]" />
                  <Github className="mr-2 h-5 w-5" />
                  Clone on GitHub
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="group h-14 px-8 text-base rounded-full glass-light border-white/10 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300 interactive"
              >
                <Link href="/chat">
                  <ExternalLink className="mr-2 h-5 w-5 text-white/70 group-hover:text-white transition-colors" />
                  Try the Demo
                </Link>
              </Button>
            </div>

            {/* Deploy badges */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="https://vercel.com/new/clone?repository-url=https://github.com/rejisterjack/rag-starter-kit"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300 interactive"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 76 65"
                  fill="currentColor"
                  role="img"
                  aria-label="Vercel"
                >
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                </svg>
                Deploy to Vercel
              </Link>
              <Link
                href="https://railway.app/template/rag-starter-kit"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300 interactive"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  role="img"
                  aria-label="Railway"
                >
                  <path d="M22 11.994c0-.552-.448-1-1-1h-2.172a2.999 2.999 0 0 1-1.414-.354l-1.414-.816a1 1 0 0 0-1.264.128l-1.416 1.416a2.998 2.998 0 0 1-1.414.354H8.28a2.998 2.998 0 0 1-1.414-.354l-1.416-1.416a1 1 0 0 0-1.264-.128l-1.414.816A2.999 2.999 0 0 1 1.172 11H1a1 1 0 0 0-1 1v.01c0 .552.448 1 1 1h.172a2.999 2.999 0 0 1 1.414.354l1.414.816a1 1 0 0 0 1.264-.128l1.416-1.416a2.998 2.998 0 0 1 1.414-.354h3.532a2.998 2.998 0 0 1 1.414.354l1.416 1.416a1 1 0 0 0 1.264.128l1.414-.816A2.999 2.999 0 0 1 18.828 13H21a1 1 0 0 0 1-1v-.006Z" />
                </svg>
                Deploy to Railway
              </Link>
              <Link
                href="https://render.com/deploy?repo=https://github.com/rejisterjack/rag-starter-kit"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300 interactive"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  role="img"
                  aria-label="Render"
                >
                  <path d="M21 19V5H3v14h18zm-2-12v10H5V7h14z" />
                </svg>
                Deploy to Render
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Contribution ways */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10"
        >
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-foreground">
              How to <span className="text-gradient">Get Involved</span>
            </h3>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {contributionWays.map((way, index) => (
              <motion.div
                key={way.title}
                className="group glass-heavy rounded-2xl p-6 border border-border/50 hover:border-primary/40 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.3)] interactive cursor-default"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:scale-110 transition-all duration-300 shadow-inner">
                  <way.icon className="h-6 w-6" />
                </div>
                <h4 className="text-lg font-bold text-foreground mb-2">{way.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  {way.description}
                </p>
                <Link
                  href={way.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group/link"
                >
                  {way.action}
                  <ArrowRight className="h-4 w-4 group-hover/link:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
