'use client';

import { motion } from 'framer-motion';
import { AlertCircle, Check, X } from 'lucide-react';

const comparisonData = [
  {
    feature: 'Language',
    rag: 'TypeScript',
    langchain: 'Python',
    llama: 'Python',
    scratch: 'Depends',
  },
  {
    feature: 'API cost to start',
    rag: '$0',
    langchain: 'Varies',
    llama: 'Varies',
    scratch: 'Depends',
  },
  { feature: 'Auth included', rag: 'Yes', langchain: 'No', llama: 'No', scratch: 'Build it' },
  { feature: 'Background jobs', rag: 'Inngest', langchain: 'No', llama: 'No', scratch: 'Build it' },
  {
    feature: 'Streaming UI',
    rag: 'SSE',
    langchain: 'Varies',
    llama: 'Varies',
    scratch: 'Build it',
  },
  { feature: 'One-click deploy', rag: 'Vercel', langchain: 'No', llama: 'No', scratch: 'Build it' },
  {
    feature: 'Production-ready',
    rag: 'Yes',
    langchain: 'Partial',
    llama: 'Partial',
    scratch: '3 weeks',
  },
];

export function Differentiation(): React.ReactElement {
  return (
    <section className="py-24 lg:py-32 relative">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20 mb-6">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
            Why Not Python?
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl mb-6">
            Stop Context-Switching to <span className="text-gradient">Python</span>
          </h2>
          <p className="mt-4 text-xl text-muted-foreground leading-relaxed">
            LangChain is great — if you work in Python. If you build your product in TypeScript, you
            shouldn't need a separate Python service just to add AI.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="glass-panel rounded-3xl overflow-hidden border border-border shadow-2xl"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="p-4 sm:p-6 font-semibold text-foreground w-1/3">Feature</th>
                  <th className="p-4 sm:p-6 font-bold text-primary bg-primary/5 w-1/6">
                    RAG Starter Kit
                  </th>
                  <th className="p-4 sm:p-6 font-medium text-muted-foreground w-1/6">
                    LangChain (Python)
                  </th>
                  <th className="p-4 sm:p-6 font-medium text-muted-foreground w-1/6">LlamaIndex</th>
                  <th className="p-4 sm:p-6 font-medium text-muted-foreground w-1/6">
                    From Scratch
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-sm sm:text-base">
                {comparisonData.map((row) => (
                  <tr key={row.feature} className="hover:bg-muted/10 transition-colors">
                    <td className="p-4 sm:p-6 font-medium text-foreground">{row.feature}</td>
                    <td className="p-4 sm:p-6 bg-primary/5 text-foreground font-medium flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      {row.rag}
                    </td>
                    <td className="p-4 sm:p-6 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {row.langchain === 'No' ? (
                          <X className="h-4 w-4 text-red-500/70" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500/70" />
                        )}
                        {row.langchain}
                      </div>
                    </td>
                    <td className="p-4 sm:p-6 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        {row.llama === 'No' ? (
                          <X className="h-4 w-4 text-red-500/70" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-500/70" />
                        )}
                        {row.llama}
                      </div>
                    </td>
                    <td className="p-4 sm:p-6 text-muted-foreground italic">{row.scratch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CTA after table */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="/demo"
              onClick={() => {
                const w = window as unknown as { plausible?: (e: string, o?: object) => void };
                w.plausible?.('differentiation_cta_click', {
                  props: { cta: 'try_demo', location: 'differentiation' },
                });
              }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
            >
              Try the live demo
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </a>
            <a
              href="https://github.com/rejisterjack/rag-starter-kit"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                const w = window as unknown as { plausible?: (e: string, o?: object) => void };
                w.plausible?.('differentiation_cta_click', {
                  props: { cta: 'clone_github', location: 'differentiation' },
                });
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-7 py-3 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
            >
              Clone on GitHub — it&apos;s free
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
