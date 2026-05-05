'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Bot, FileText, MessageSquare, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const steps = [
  {
    step: '01',
    icon: FileText,
    title: 'Upload Your Documents',
    description:
      'Drag in PDFs, Word docs, Markdown, or paste a URL. Inngest background jobs automatically chunk and embed your content into pgvector — no manual processing.',
    detail: 'PDF · DOCX · MD · TXT · URL',
    color: 'from-sky-500/20 to-sky-500/5',
    iconColor: 'text-sky-400',
    border: 'border-sky-500/20',
  },
  {
    step: '02',
    icon: Bot,
    title: 'Ask Questions Naturally',
    description:
      'Your AI retrieves the most relevant document chunks using hybrid vector + keyword search, then generates a grounded answer — with source citations for every claim.',
    detail: 'Hybrid Search · Citations · Context-Aware',
    color: 'from-purple-500/20 to-purple-500/5',
    iconColor: 'text-purple-400',
    border: 'border-purple-500/20',
  },
  {
    step: '03',
    icon: Zap,
    title: 'Stream. Deploy. Own It.',
    description:
      'Responses stream token-by-token via SSE. Deploy to Vercel in one click. Your documents stay in your own database — nothing touches a third-party server.',
    detail: 'SSE Streaming · Vercel · Self-Hosted',
    color: 'from-green-500/20 to-green-500/5',
    iconColor: 'text-green-400',
    border: 'border-green-500/20',
  },
];

export function HowItWorks(): React.ReactElement {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.03),transparent_70%)] -z-10" />
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
            <MessageSquare className="h-4 w-4" />
            <span>How It Works</span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl mb-6">
            From Documents to
            <br />
            <span className="text-gradient">Answers in 3 Steps</span>
          </h2>
          <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            No Python, no config hell, no infrastructure management. Upload your content, ask
            questions, and own everything.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid gap-6 lg:grid-cols-3 relative">
          {/* Connector lines on desktop */}
          <div className="hidden lg:block absolute top-16 left-[33%] right-[33%] h-px bg-gradient-to-r from-border/30 via-primary/30 to-border/30 z-0" />

          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10"
            >
              <div
                className={`glass-panel rounded-2xl p-8 border ${step.border} bg-gradient-to-b ${step.color} h-full flex flex-col`}
              >
                {/* Step number */}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-5xl font-black text-foreground/5 select-none leading-none">
                    {step.step}
                  </span>
                  <div
                    className={`h-14 w-14 rounded-2xl bg-background/50 flex items-center justify-center border ${step.border} ${step.iconColor}`}
                  >
                    <step.icon className="h-7 w-7" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed flex-grow mb-6">
                  {step.description}
                </p>

                {/* Tech detail tag */}
                <div
                  className={`inline-flex items-center text-xs font-mono font-medium ${step.iconColor} bg-background/40 border ${step.border} rounded-lg px-3 py-1.5 w-fit`}
                >
                  {step.detail}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <Button
            asChild
            size="lg"
            className="group h-14 px-8 text-base rounded-full hover:scale-105 transition-all duration-300 hover:shadow-[0_0_2rem_-0.5rem_hsl(var(--primary))]"
          >
            <Link href="/demo">
              See the full pipeline live
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
