'use client';

import { motion } from 'framer-motion';
import { Check, Copy, Play, RotateCcw, Terminal } from 'lucide-react';
import { useState } from 'react';
import { useIntersectionObserver } from '@/hooks/use-intersection-observer';
import { useTypewriter } from '@/hooks/use-typewriter';

const setupCommands = [
  'git clone https://github.com/rejisterjack/rag-starter-kit.git',
  'cd rag-starter-kit && cp .env.example .env',
  '# Get FREE API keys from openrouter.ai/keys and aistudio.google.com',
  'pnpm dev',
  '🚀 Ready at http://localhost:3000',
];

export function SetupAnimator(): React.ReactElement {
  const { ref, isInView } = useIntersectionObserver({ threshold: 0.3 });
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);

  const { displayText, isTyping, isComplete, restart } = useTypewriter({
    text: setupCommands,
    speed: 35,
    delay: 600,
    enabled: isInView && started,
  });

  const handleCopy = () => {
    const rawText = setupCommands.join('\n').replace(/^\ud83c\udf40\s+/, '');
    navigator.clipboard.writeText(rawText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleStart = () => {
    setStarted(true);
  };

  const handleRestart = () => {
    restart();
  };

  const lines = displayText.split('\n');

  return (
    <section ref={ref} className="py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Ship in <span className="text-gradient">2 Minutes</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Clone, configure two free API keys, and deploy. No Python. No credit card. No tutorial
            hopping.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          {/* Terminal Window */}
          <div className="glass-heavy rounded-2xl overflow-hidden border border-border/50 shadow-2xl shadow-primary/5">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/50">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-xs text-muted-foreground font-mono ml-3">setup.sh — zsh</span>
              </div>
              <div className="flex items-center gap-2">
                {!started ? (
                  <button
                    type="button"
                    onClick={handleStart}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    <Play className="h-3 w-3" />
                    Run
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Replay
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium hover:text-foreground transition-colors"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="p-4 sm:p-6 font-mono text-sm min-h-[280px]">
              {!started ? (
                <div className="flex flex-col items-center justify-center h-[220px] gap-4">
                  <Terminal className="h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">Click "Run" to see the setup animation</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {lines.map((line, index) => {
                    const isPrompt = line.startsWith('$') || line.startsWith('#');
                    const isSuccess = line.startsWith('🚀');

                    return (
                      <motion.div
                        // biome-ignore lint/suspicious/noArrayIndexKey: terminal lines are display-only
                        key={`${index}-${line}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-start gap-2"
                      >
                        {isPrompt && (
                          <span className="text-green-500 shrink-0 select-none">
                            {line.startsWith('#') ? '#' : '$'}
                          </span>
                        )}
                        {isSuccess && (
                          <span className="text-primary shrink-0 select-none">{'>'}</span>
                        )}
                        <span
                          className={
                            isPrompt
                              ? 'text-muted-foreground'
                              : isSuccess
                                ? 'text-primary font-medium'
                                : 'text-foreground'
                          }
                        >
                          {line.replace(/^[$#>🚀]\s*/u, '')}
                        </span>
                      </motion.div>
                    );
                  })}
                  {isTyping && (
                    <motion.span
                      className="inline-block w-2.5 h-5 bg-primary ml-1 align-middle"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                    />
                  )}
                  {isComplete && !isTyping && (
                    <motion.span
                      className="inline-block w-2.5 h-5 bg-primary/50 ml-1 align-middle"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Context labels */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: '🔑', label: '2 Free API Keys' },
              { icon: '⚡', label: 'Zero Infra' },
              { icon: '⚡', label: 'No Python Needed' },
              { icon: '💰', label: '$0 to Start' },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className="glass-light rounded-lg px-3 py-2 text-center"
              >
                <span className="text-lg mr-1">{item.icon}</span>
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
