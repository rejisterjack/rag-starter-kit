'use client';

import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const corePlatform = [
  'RAG pipeline (ingest → chunk → embed → retrieve → generate)',
  'Streaming SSE responses',
  'Hybrid search (vector + keyword)',
  'Source citations in every answer',
  'Voice input + output (Whisper + Web Speech)',
  'Agent mode (web search, calculator, code execution)',
];

const infrastructure = [
  'Authentication (GitHub OAuth, Google OAuth, credentials)',
  'Admin dashboard (upload, manage, delete docs)',
  'Background job processing (Inngest)',
  'Rate limiting (Upstash Redis)',
  'Analytics (PostHog + Plausible)',
  'Audit logging',
  'E2E tests (Playwright) + unit tests (Vitest)',
  'PWA support (installable, offline)',
  'One-click deploy (Vercel / Railway / Render)',
];

export function WhatsIncluded(): React.ReactElement {
  return (
    <section className="py-24 lg:py-32 relative overflow-hidden bg-muted/10 border-y border-border/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl mb-6">
            What's <span className="text-gradient">Included</span>
          </h2>
          <p className="mt-4 text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Everything you need to ship a production AI app, straight out of the box.
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Core Platform */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="glass-panel rounded-3xl p-8 border border-border"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-lg">1</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground">Core AI Platform</h3>
            </div>
            <ul className="space-y-4">
              {corePlatform.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="h-3 w-3 text-green-500" />
                  </div>
                  <span className="text-muted-foreground font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Infrastructure */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="glass-panel rounded-3xl p-8 border border-border"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-bold text-lg">2</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground">Production Infrastructure</h3>
            </div>
            <ul className="space-y-4">
              {infrastructure.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 h-5 w-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="h-3 w-3 text-green-500" />
                  </div>
                  <span className="text-muted-foreground font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 text-red-400 text-sm font-medium border border-red-500/20">
            <X className="h-4 w-4" />
            Not included: Pricing models, no-code UI, Python, Kubernetes
          </div>
        </motion.div>
      </div>
    </section>
  );
}
