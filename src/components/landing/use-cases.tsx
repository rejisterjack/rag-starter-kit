'use client';

import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, Briefcase, Building2, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { useTrackEvent } from '@/hooks/use-analytics-event';

const useCases = [
  {
    icon: Briefcase,
    title: 'Built in a weekend, not 3 weeks',
    story:
      'Client wants an AI chatbot trained on their documentation. Clone the repo, upload their docs, configure two free API keys, and deploy to Vercel. Done by Monday.',
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-500/10',
    cta: 'Start this scenario',
    href: '/demo',
  },
  {
    icon: BarChart3,
    title: 'Support tickets down 40%',
    story:
      "Index your SaaS product's entire documentation site and help articles. Watch repetitive L1 support questions get answered automatically in real-time.",
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
    cta: 'See it in action',
    href: '/demo',
  },
  {
    icon: Building2,
    title: 'Company knowledge, searchable',
    story:
      'Years of scattered Confluence pages and Google Drive documents, finally indexed and searchable through a single, secure chat interface for your entire team.',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    cta: 'Try with your docs',
    href: '/demo',
  },
  {
    icon: GraduationCap,
    title: 'Learn production RAG for free',
    story:
      'A real production codebase, not a tutorial. See exactly how chunking, embedding, pgvector, and streaming SSE work together without paying for API credits.',
    iconColor: 'text-green-400',
    iconBg: 'bg-green-500/10',
    cta: 'Explore the code',
    href: 'https://github.com/rejisterjack/rag-starter-kit',
  },
];

export function UseCases(): React.ReactElement {
  const { track } = useTrackEvent();

  return (
    <section className="py-24 lg:py-32 relative bg-black/40 border-y border-border/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl mb-6">
            Real <span className="text-gradient">Use Cases</span>
          </h2>
          <p className="mt-4 text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            From agency deliverables to internal tools, here is how developers are using the starter
            kit today.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2">
          {useCases.map((useCase, i) => (
            <motion.div
              key={useCase.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-light rounded-2xl p-6 sm:p-8 flex flex-col justify-between border border-border/30 hover:border-primary/40 transition-colors group"
            >
              <div>
                <div
                  className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl ${useCase.iconBg} ${useCase.iconColor} transition-transform group-hover:scale-110`}
                >
                  <useCase.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{useCase.title}</h3>
                <p className="text-muted-foreground leading-relaxed mb-6">{useCase.story}</p>
              </div>
              <Link
                href={useCase.href}
                target={useCase.href.startsWith('http') ? '_blank' : undefined}
                rel={useCase.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                onClick={() =>
                  track('use_case_cta_click', {
                    use_case: useCase.title,
                    cta: useCase.cta,
                    location: 'use_cases',
                  })
                }
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group/link mt-auto"
              >
                {useCase.cta}
                <ArrowRight className="h-4 w-4 group-hover/link:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
