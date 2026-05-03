'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BrainCircuit, Database, Scissors, Search, Upload, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';

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
      'Drag & drop documents into the chat interface. Cloudinary storage handles files of any size. Webhook ingestion also supported for URL-based documents.',
    color: '14, 165, 233', // Sky blue
  },
  {
    id: 'chunk',
    icon: Scissors,
    title: 'Chunk',
    description: 'Intelligent text splitting',
    detail:
      'Recursive text splitting with configurable chunk size (default 1000 chars) and overlap (200 chars). Preserves semantic boundaries for optimal retrieval.',
    color: '168, 85, 247', // Purple
  },
  {
    id: 'embed',
    icon: BrainCircuit,
    title: 'Embed',
    description: 'Google Gemini vectors',
    detail:
      'Free Google Gemini embedding tier (1,500 req/day). Generates 768-dimensional dense vectors stored in PostgreSQL pgvector extension.',
    color: '236, 72, 153', // Pink
  },
  {
    id: 'store',
    icon: Database,
    title: 'Store',
    description: 'pgvector + PostgreSQL',
    detail:
      'Vectors stored with HNSW index for approximate nearest neighbor search. Cosine similarity for fast semantic retrieval with sub-millisecond latency.',
    color: '45, 212, 191', // Teal
  },
  {
    id: 'retrieve',
    icon: Search,
    title: 'Retrieve',
    description: 'Hybrid similarity + keyword',
    detail:
      'Combines vector similarity search with keyword filtering. Configurable top-k (default 5) and similarity threshold (default 0.7) for precision tuning.',
    color: '245, 158, 11', // Amber
  },
  {
    id: 'generate',
    icon: Zap,
    title: 'Generate',
    description: 'Streaming via OpenRouter',
    detail:
      'OpenRouter free models (DeepSeek, Mistral, Llama, Gemma) generate context-aware responses with source citations. Switches to Anthropic/Ollama via env var.',
    color: '34, 197, 94', // Green
  },
];

export function RagPipelineDiagram(): React.ReactElement {
  const [activeStage, setActiveStage] = useState<string | null>(stages[0].id);
  const activeIndex = activeStage ? stages.findIndex((s) => s.id === activeStage) : 0;

  // Auto-cycle through stages for demo effect until user interacts
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (isHovering) return;

    const interval = setInterval(() => {
      setActiveStage((prev) => {
        const currentIndex = stages.findIndex((s) => s.id === prev);
        const nextIndex = (currentIndex + 1) % stages.length;
        return stages[nextIndex].id;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [isHovering]);

  return (
    <section
      className="py-24 lg:py-32 relative overflow-hidden"
      aria-label="RAG Pipeline Diagram"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Dynamic Background Glow based on active stage */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-3xl z-10" />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20"
          animate={{
            background: `radial-gradient(circle, rgb(\${stages[activeIndex]?.color || '0,0,0'}) 0%, transparent 70%)`,
          }}
          transition={{ duration: 1 }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            How the <span className="text-gradient">RAG Pipeline</span> Works
          </h2>
          <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Click each stage to explore. Every step is configurable, observable, and runs entirely
            in TypeScript.
          </p>
        </motion.div>

        <div className="relative">
          {/* Animated SVG Data Flow Lines (Desktop) */}
          <div className="hidden lg:block absolute top-[45px] left-0 right-0 h-[2px] z-0 px-[8%]">
            <div className="relative w-full h-full bg-border/40 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
              {/* Particle moving through pipeline */}
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
                animate={{
                  left: ['0%', '100%'],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            </div>
          </div>

          {/* Stage cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6 relative z-10">
            {stages.map((stage, index) => {
              const isActive = activeStage === stage.id;

              return (
                <motion.div
                  key={stage.id}
                  className="relative group cursor-pointer"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  onMouseEnter={() => {
                    setIsHovering(true);
                    setActiveStage(stage.id);
                  }}
                  onClick={() => setActiveStage(stage.id)}
                >
                  <motion.div
                    className={`h-full text-center glass-panel rounded-2xl p-5 transition-all duration-300 \${
                      isActive
                        ? 'border border-primary/50 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] bg-background/80'
                        : 'border border-border/50 hover:border-border'
                    }`}
                    animate={{
                      scale: isActive ? 1.05 : 1,
                      y: isActive ? -8 : 0,
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    {/* Stage number */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <motion.div
                        className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shadow-lg transition-colors duration-500 \${
                          isActive || activeIndex > index
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                        animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                        transition={isActive ? { duration: 1, repeat: Infinity } : {}}
                      >
                        {index + 1}
                      </motion.div>
                    </div>

                    {/* Icon */}
                    <div
                      className="mx-auto mb-4 mt-2 inline-flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-500 relative"
                      style={{
                        backgroundColor: isActive ? `rgba(\${stage.color}, 0.15)` : '',
                        color: isActive ? `rgb(\${stage.color})` : '',
                      }}
                    >
                      {isActive && (
                        <motion.div
                          className="absolute inset-0 rounded-xl"
                          style={{ border: `1px solid rgba(\${stage.color}, 0.5)` }}
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                      <stage.icon
                        className={`h-6 w-6 \${!isActive ? 'text-muted-foreground group-hover:text-foreground transition-colors' : ''}`}
                      />
                    </div>

                    <h3 className="text-sm font-bold text-foreground mb-1 tracking-tight">
                      {stage.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider hidden sm:block">
                      {stage.description}
                    </p>
                  </motion.div>

                  {/* Active Indicator Arrow */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        className="hidden lg:block absolute -bottom-8 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[10px]"
                        style={{ borderBottomColor: `rgba(\${stage.color}, 0.3)` }}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {/* Detail panel */}
          <div className="mt-8 lg:mt-12 min-h-[160px]">
            <AnimatePresence mode="wait">
              {activeStage && (
                <motion.div
                  key={activeStage}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="glass-heavy rounded-3xl p-6 sm:p-8 border overflow-hidden relative"
                  style={{
                    borderColor: `rgba(\${stages[activeIndex].color}, 0.3)`,
                    boxShadow: `0 20px 40px -20px rgba(\${stages[activeIndex].color}, 0.15)`,
                  }}
                >
                  <div
                    className="absolute top-0 left-0 w-full h-1"
                    style={{
                      background: `linear-gradient(90deg, transparent, rgba(\${stages[activeIndex].color}, 0.8), transparent)`,
                    }}
                  />

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                    <div
                      className="shrink-0 h-16 w-16 rounded-2xl flex items-center justify-center relative shadow-lg"
                      style={{ backgroundColor: `rgba(\${stages[activeIndex].color}, 0.15)` }}
                    >
                      {(() => {
                        const StageIcon = stages[activeIndex].icon;
                        return (
                          <StageIcon
                            className="h-8 w-8"
                            style={{ color: `rgb(\${stages[activeIndex].color})` }}
                          />
                        );
                      })()}
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-foreground mb-3 tracking-tight">
                        {stages[activeIndex].title}{' '}
                        <span className="text-muted-foreground font-medium text-lg">
                          | {stages[activeIndex].description}
                        </span>
                      </h4>
                      <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
                        {stages[activeIndex].detail}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
