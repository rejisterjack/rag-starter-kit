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
    <section className="py-24 lg:py-32 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main CTA Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl bg-primary p-8 sm:p-12 lg:p-16 text-center mb-16"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 -z-0 pointer-events-none">
            <motion.div
              className="absolute top-0 left-0 w-[400px] h-[400px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(255,255,255,0.12), transparent 70%)',
                filter: 'blur(60px)',
              }}
              animate={{
                x: [0, 30, -20, 0],
                y: [0, -20, 30, 0],
              }}
              transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(200,100,255,0.15), transparent 70%)',
                filter: 'blur(60px)',
              }}
              animate={{
                x: [0, -20, 20, 0],
                y: [0, 20, -10, 0],
              }}
              transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: -4 }}
            />
          </div>

          <div className="relative z-10">
            <motion.div
              initial={{ scale: 0.9 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/90 mb-6"
            >
              <Heart className="h-4 w-4 text-red-300" />
              <span>MIT Licensed — Free Forever</span>
            </motion.div>

            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
              Built by Developers, <br className="hidden sm:block" />
              <span className="text-white/80">for Developers</span>
            </h2>

            <p className="text-lg text-white/70 max-w-2xl mx-auto mb-10">
              This is not a SaaS. There is no pricing page. No vendor lock-in. No central server.
              Clone it, own it, deploy it. Your data never leaves your infrastructure.
            </p>

            {/* GitHub Stats */}
            <GitHubStats />

            {/* Deploy buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="h-14 px-8 text-base rounded-full hover:scale-105 transition-transform duration-300"
              >
                <Link
                  href="https://github.com/rejisterjack/rag-starter-kit"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="mr-2 h-5 w-5" />
                  Clone on GitHub
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-14 px-8 text-base rounded-full bg-transparent border-white/30 text-white hover:bg-white/10 hover:border-white/50 transition-all duration-300"
              >
                <Link href="/chat">
                  <ExternalLink className="mr-2 h-5 w-5" />
                  Try the Demo
                </Link>
              </Button>
            </div>

            {/* Deploy badges */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="https://vercel.com/new/clone?repository-url=https://github.com/rejisterjack/rag-starter-kit"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/20 transition-colors"
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
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/20 transition-colors"
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
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/20 transition-colors"
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
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h3 className="text-xl font-semibold text-foreground text-center mb-8">
            How to Get Involved
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {contributionWays.map((way, index) => (
              <motion.div
                key={way.title}
                className="glass-panel rounded-xl p-5 hover:bg-primary/5 transition-colors group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
              >
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <way.icon className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1.5">{way.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  {way.description}
                </p>
                <Link
                  href={way.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {way.action}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
