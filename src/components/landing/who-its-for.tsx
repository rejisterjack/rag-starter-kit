'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, BookOpen, Briefcase, Code2 } from 'lucide-react';
import Link from 'next/link';
import { useTrackEvent } from '@/hooks/use-analytics-event';

const personas = [
  {
    icon: Code2,
    title: 'The TypeScript Dev',
    subtitle: 'Building a product in Next.js',
    description:
      "You need RAG, but you don't want to learn Python infrastructure or stitch together 5 different tutorials. You want a codebase that feels native to your stack.",
    warning: 'Not for you if: You prefer Python or LangChain.',
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-500/10',
    cta: 'Clone the repo',
    href: 'https://github.com/rejisterjack/rag-starter-kit',
  },
  {
    icon: BookOpen,
    title: 'The Learner',
    subtitle: 'Breaking into AI engineering',
    description:
      "You're tired of 'hello world' tutorials. You want to see how real streaming, vector databases, and background jobs work together in a real app, without spending a dime on API credits.",
    warning: 'Not for you if: You want a no-code chatbot builder.',
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/10',
    cta: 'Try the live demo',
    href: '/demo',
  },
  {
    icon: Briefcase,
    title: 'The Freelancer / Agency',
    subtitle: 'Delivering client AI projects',
    description:
      "Clients want chatbots trained on their docs. Don't build from scratch. Clone this, customize the UI, upload their docs, and deploy by Monday. Charge for value, not boilerplate.",
    warning: 'Not for you if: You need enterprise vendor SLAs out of the box.',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    cta: 'See all features',
    href: '#features',
  },
];

export function WhoItsFor(): React.ReactElement {
  const { track } = useTrackEvent();

  return (
    <section className="py-24 lg:py-32 relative overflow-hidden bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Who is <span className="text-gradient">RAG Starter Kit</span> For?
          </h2>
          <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
            Built for developers who want to ship. Not for those looking for a no-code tool.
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-3">
          {personas.map((persona, i) => (
            <motion.div
              key={persona.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="glass-panel relative rounded-2xl p-8 border border-border/50 hover:border-primary/30 transition-all duration-300 group flex flex-col"
            >
              <div
                className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl ${persona.iconBg} ${persona.iconColor} transition-transform group-hover:scale-110`}
              >
                <persona.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">{persona.title}</h3>
              <p className="text-sm font-medium text-primary/80 mb-4">{persona.subtitle}</p>
              <p className="text-muted-foreground leading-relaxed mb-6 flex-grow">
                {persona.description}
              </p>
              <div className="mt-auto space-y-4">
                <div className="pt-4 border-t border-border/30 flex items-start gap-2 text-xs text-muted-foreground/80">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500/70" />
                  <span>{persona.warning}</span>
                </div>
                <Link
                  href={persona.href}
                  target={persona.href.startsWith('http') ? '_blank' : undefined}
                  rel={persona.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  onClick={() =>
                    track('who_its_for_cta_click', {
                      persona: persona.title,
                      cta: persona.cta,
                      location: 'who_its_for',
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group/link"
                >
                  {persona.cta}
                  <ArrowRight className="h-4 w-4 group-hover/link:translate-x-1 transition-transform" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
