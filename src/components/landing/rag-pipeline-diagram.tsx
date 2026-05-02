'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BrainCircuit, Database, Scissors, Search, Upload, Zap } from 'lucide-react';
import { useState } from 'react';

interface Stage {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  detail: string;
  color: string;
}

const stages: Stage[] = [
  {
    id: 'upload',
    icon: Upload,
    title: 'Upload',
    description: 'PDF, DOCX, TXT, Markdown',
    detail:
      'Drag & drop documents into the chat interface. MinIO/S3-compatible storage handles files of any size. Webhook ingestion also supported for URL-based documents.',
    color: 'hsl(220 100% 50%)',
  },
  {
    id: 'chunk',
    icon: Scissors,
    title: 'Chunk',
    description: 'Intelligent text splitting',
    detail:
      'Recursive text splitting with configurable chunk size (default 1000 chars) and overlap (200 chars). Preserves semantic boundaries for optimal retrieval.',
    color: 'hsl(260 100% 65%)',
  },
  {
    id: 'embed',
    icon: BrainCircuit,
    title: 'Embed',
    description: 'Google Gemini vectors',
    detail:
      'Free Google Gemini embedding tier (1,500 req/day). Generates 768-dimensional dense vectors stored in PostgreSQL pgvector extension.',
    color: 'hsl(320 100% 60%)',
  },
  {
    id: 'store',
    icon: Database,
    title: 'Store',
    description: 'pgvector + PostgreSQL',
    detail:
      'Vectors stored with HNSW index for approximate nearest neighbor search. Cosine similarity for fast semantic retrieval with sub-millisecond latency.',
    color: 'hsl(180 100% 40%)',
  },
  {
    id: 'retrieve',
    icon: Search,
    title: 'Retrieve',
    description: 'Hybrid similarity + keyword',
    detail:
      'Combines vector similarity search with keyword filtering. Configurable top-k (default 5) and similarity threshold (default 0.7) for precision tuning.',
    color: 'hsl(40 100% 50%)',
  },
  {
    id: 'generate',
    icon: Zap,
    title: 'Generate',
    description: 'Streaming via OpenRouter',
    detail:
      'OpenRouter free models (DeepSeek, Mistral, Llama, Gemma) generate context-aware responses with source citations. Switches to Anthropic/Ollama via env var.',
    color: 'hsl(140 100% 45%)',
  },
];

export function RagPipelineDiagram(): React.ReactElement {
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const activeIndex = activeStage ? stages.findIndex((s) => s.id === activeStage) : -1;

  return (
    <section className="py-24 lg:py-32 bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            How the <span className="text-gradient">RAG Pipeline</span> Works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Click each stage to explore. Every step is configurable, observable, and runs entirely
            in TypeScript.
          </p>
        </motion.div>

        {/* Pipeline stages */}
        <div className="relative">
          {/* Connection lines (desktop) */}
          <div className="hidden lg:flex absolute top-[60px] left-0 right-0 justify-center px-16">
            {stages.slice(0, -1).map((_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static pipeline steps
              <div key={index} className="flex-1 flex items-center justify-center">
                <motion.div
                  className="h-0.5 w-full max-w-[80px] mx-2"
                  style={{
                    background:
                      index < activeIndex
                        ? `linear-gradient(90deg, ${stages[index].color}, ${stages[index + 1].color})`
                        : 'hsl(var(--border))',
                  }}
                  animate={{
                    opacity: index < activeIndex ? 1 : 0.3,
                    scaleX: index < activeIndex ? 1 : 0.5,
                  }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            ))}
          </div>

          {/* Stage cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-3">
            {stages.map((stage, index) => {
              const isActive = activeStage === stage.id;
              const isPast = activeIndex > index && activeStage !== null;

              return (
                <motion.button
                  key={stage.id}
                  className={`relative group cursor-pointer text-left glass-panel rounded-xl p-4 transition-all duration-300 ${
                    isActive
                      ? 'ring-2 ring-primary/50 shadow-lg shadow-primary/10'
                      : 'hover:ring-1 hover:ring-border'
                  }`}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  onClick={() => setActiveStage(isActive ? null : stage.id)}
                  whileHover={{ y: -4, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* Stage number */}
                  <span
                    className={`absolute -top-2 -right-2 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors ${
                      isActive || isPast
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {index + 1}
                  </span>

                  {/* Icon */}
                  <div
                    className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground group-hover:text-primary'
                    }`}
                  >
                    <stage.icon className="h-5 w-5" />
                  </div>

                  <h3 className="text-sm font-semibold text-foreground mb-1">{stage.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {stage.description}
                  </p>

                  {/* Mobile arrow */}
                  {index < stages.length - 1 && (
                    <div className="lg:hidden absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                      <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Detail panel */}
          <AnimatePresence mode="wait">
            {activeStage && (
              <motion.div
                key={activeStage}
                initial={{ opacity: 0, y: 20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-8 glass-panel rounded-xl p-6 overflow-hidden"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="shrink-0 h-12 w-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${stages[activeIndex].color}20` }}
                  >
                    {(() => {
                      const StageIcon = stages[activeIndex].icon;
                      return (
                        <StageIcon
                          className="h-6 w-6"
                          style={{ color: stages[activeIndex].color }}
                        />
                      );
                    })()}
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-foreground mb-2">
                      {stages[activeIndex].title}
                    </h4>
                    <p className="text-muted-foreground leading-relaxed">
                      {stages[activeIndex].detail}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
