'use client';

import { motion, useMotionValue, useSpring, useTransform, type Variants } from 'framer-motion';
import { ArrowRight, Github, Sparkles, Terminal } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const textReveal: Variants = {
  initial: { y: 100, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
};

const fadeUp: Variants = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
};

export function HeroSection(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse position for parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for mouse movement
  const smoothMouseX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  // Transforms for 3D parallax elements
  const rotateX = useTransform(smoothMouseY, [-0.5, 0.5], [15, -15]);
  const rotateY = useTransform(smoothMouseX, [-0.5, 0.5], [-15, 15]);

  const bgX = useTransform(smoothMouseX, [-0.5, 0.5], [-50, 50]);
  const bgY = useTransform(smoothMouseY, [-0.5, 0.5], [-50, 50]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Normalize mouse coordinates from -0.5 to 0.5
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX.set(x);
      mouseY.set(y);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-[95vh] flex items-center justify-center overflow-hidden pt-20 pb-12 lg:pt-32 lg:pb-24 perspective-1000"
    >
      {/* Animated interactive background orbs */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        <motion.div
          style={{ x: bgX, y: bgY }}
          className="absolute top-[10%] left-[15%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full"
        >
          <div className="w-full h-full rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.15),transparent_60%)] blur-[80px]" />
        </motion.div>

        <motion.div
          style={{ x: useTransform(bgX, (v) => -v), y: useTransform(bgY, (v) => -v) }}
          className="absolute bottom-[10%] right-[10%] w-[50vw] h-[50vw] max-w-[500px] max-h-[500px] rounded-full"
        >
          <div className="w-full h-full rounded-full bg-[radial-gradient(circle,hsl(320_100%_60%/0.1),transparent_60%)] blur-[80px]" />
        </motion.div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full z-10">
        <motion.div
          className="text-center max-w-5xl mx-auto"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          {/* Badge */}
          <motion.div variants={fadeUp} className="mb-8 flex justify-center">
            <Link
              href="https://github.com/rejisterjack/rag-starter-kit"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full glass-light px-4 py-2 text-sm font-medium text-primary hover:scale-105 transition-all duration-300 hover:shadow-[0_0_2rem_-0.5rem_hsl(var(--primary))]"
            >
              <Sparkles className="h-4 w-4 animate-pulse text-primary" />
              <span>Open Source on GitHub</span>
              <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-xs group-hover:bg-primary/30 transition-colors">
                MIT License
              </span>
            </Link>
          </motion.div>

          {/* Headline - Advanced Text Reveal */}
          <div className="overflow-hidden mb-6">
            <motion.h1
              variants={textReveal}
              className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl xl:text-[5.5rem] leading-[1.1]"
            >
              The <span className="text-gradient">TypeScript-Native</span>
            </motion.h1>
          </div>
          <div className="overflow-hidden mb-8">
            <motion.h1
              variants={textReveal}
              className="text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl xl:text-[5.5rem] leading-[1.1]"
            >
              RAG Platform
            </motion.h1>
          </div>

          {/* Subheadline */}
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-muted-foreground leading-relaxed"
          >
            Production-ready. Self-hostable.{' '}
            <span className="text-foreground font-medium">Zero API costs.</span>
            <br className="hidden sm:block" />
            Deploy an AI document chatbot in minutes — no Python, no credit card, no compromises.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              asChild
              size="lg"
              className="group relative overflow-hidden h-14 px-8 text-base rounded-full bg-primary text-primary-foreground hover:scale-105 transition-all duration-500 hover:shadow-[0_0_3rem_-0.5rem_hsl(var(--primary))]"
            >
              <Link
                href="https://github.com/rejisterjack/rag-starter-kit"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,hsl(var(--background)/0.2),transparent)] -translate-x-[150%] group-hover:animate-[shimmer_1.5s_infinite]" />
                <Github className="mr-2 h-5 w-5" />
                Clone & Deploy
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-14 px-8 text-base rounded-full glass-light hover:bg-primary/5 hover:border-primary/50 transition-all duration-300 interactive"
            >
              <Link href="/chat">
                <Terminal className="mr-2 h-5 w-5 text-primary" />
                Try Live Demo
              </Link>
            </Button>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            variants={fadeUp}
            className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-6 py-8 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-border/50 to-transparent h-[1px]" />
            <div className="absolute inset-0 top-auto bg-gradient-to-r from-transparent via-border/50 to-transparent h-[1px]" />

            {[
              { value: '2 min', label: 'Setup time' },
              { value: '$0', label: 'To run' },
              { value: '100%', label: 'TypeScript' },
              { value: 'MIT', label: 'License' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1 + i * 0.1, duration: 0.5 }}
              >
                <div className="text-3xl font-bold text-foreground sm:text-4xl tracking-tight">
                  {stat.value}
                </div>
                <div className="mt-2 text-sm text-muted-foreground font-medium uppercase tracking-wider">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* 3D Floating Terminal Preview */}
        <div className="relative mt-16 max-w-4xl mx-auto [perspective:1000px]">
          <motion.div
            className="glass-heavy rounded-2xl p-1 relative z-10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] border border-white/10"
            style={{ rotateX, rotateY }}
            initial={{ opacity: 0, y: 100, rotateX: 20 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 1, duration: 1, ease: 'easeOut' }}
          >
            <div className="bg-black/40 rounded-xl p-4 sm:p-6 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-[0_0_10px_#ff5f56]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-[0_0_10px_#ffbd2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-[0_0_10px_#27c93f]" />
                </div>
                <span className="text-xs text-muted-foreground/80 font-mono ml-4 select-none">
                  ~ / projects / rag-starter-kit
                </span>
              </div>
              <div className="font-mono text-sm sm:text-base space-y-2 text-muted-foreground">
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.5 }}
                >
                  <span className="text-primary font-bold">➜</span>{' '}
                  <span className="text-blue-400">~</span> git clone
                  https://github.com/rejisterjack/rag-starter-kit.git
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 2.0 }}
                >
                  <span className="text-primary font-bold">➜</span>{' '}
                  <span className="text-blue-400">rag-starter-kit</span> cp .env.example .env &&
                  pnpm dev
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.5 }}
                  className="text-foreground"
                >
                  [+] Running 4/4
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.6 }}
                  className="text-green-400/80 pl-4"
                >
                  ✔ Container pgvector-db Started
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.7 }}
                  className="text-green-400/80 pl-4"
                >
                  ✔ Container redis-cache Started
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 3.0 }}
                  className="text-primary font-medium mt-4"
                >
                  🚀 Ready at http://localhost:3000
                </motion.p>
              </div>
            </div>
          </motion.div>

          {/* Decorative floating elements */}
          <motion.div
            className="absolute -top-6 -right-6 sm:-top-10 sm:-right-10 glass-panel rounded-2xl p-4 z-20 shadow-2xl"
            style={{ y: useTransform(smoothMouseY, [-0.5, 0.5], [-20, 20]) }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2.2, duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-75" />
              </div>
              <span className="text-sm font-semibold text-foreground tracking-wide">
                SSE Streaming
              </span>
            </div>
          </motion.div>

          <motion.div
            className="absolute -bottom-6 -left-6 sm:-bottom-10 sm:-left-10 glass-panel rounded-2xl p-4 z-20 shadow-2xl"
            style={{ y: useTransform(smoothMouseY, [-0.5, 0.5], [20, -20]) }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2.4, duration: 0.5 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                <div className="w-4 h-4 rounded-full bg-blue-500 animate-pulse" />
              </div>
              <span className="text-sm font-semibold text-foreground tracking-wide">pgvector</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
