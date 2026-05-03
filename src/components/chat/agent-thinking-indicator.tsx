'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Check, ChevronDown, Circle, Loader2, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface AgentThinkingStep {
  id?: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
}

export interface AgentThinkingIndicatorProps {
  steps?: AgentThinkingStep[];
  currentTool?: string;
  isThinking: boolean;
}

// ============================================================================
// Step status icon
// ============================================================================

function StepStatusIcon({ status }: { status: AgentThinkingStep['status'] }) {
  switch (status) {
    case 'active':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
    case 'done':
      return <Check className="h-3.5 w-3.5 text-emerald-400" />;
    case 'error':
      return <X className="h-3.5 w-3.5 text-red-400" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />;
  }
}

// ============================================================================
// Animated thinking dots
// ============================================================================

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-primary"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </span>
  );
}

// ============================================================================
// Default step labels for common agent phases
// ============================================================================

function getDefaultSteps(): AgentThinkingStep[] {
  return [
    { id: 'analyze', label: 'Analyzing query', status: 'pending' },
    { id: 'search', label: 'Searching documents', status: 'pending' },
    { id: 'tool', label: 'Running tool', status: 'pending' },
    { id: 'answer', label: 'Formulating answer', status: 'pending' },
  ];
}

// ============================================================================
// Main component
// ============================================================================

export function AgentThinkingIndicator({
  steps: externalSteps,
  currentTool,
  isThinking,
}: AgentThinkingIndicatorProps) {
  const [showDetails, setShowDetails] = useState(true);

  const steps = useMemo(() => {
    if (externalSteps && externalSteps.length > 0) return externalSteps;
    if (!isThinking) return [];
    return getDefaultSteps();
  }, [externalSteps, isThinking]);

  const activeStep = useMemo(() => steps.find((s) => s.status === 'active'), [steps]);

  const completedCount = useMemo(() => steps.filter((s) => s.status === 'done').length, [steps]);

  const progress = useMemo(() => {
    if (steps.length === 0) return 0;
    return Math.round((completedCount / steps.length) * 100);
  }, [completedCount, steps.length]);

  if (!isThinking) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="py-6 px-4 mb-4 rounded-3xl glass max-w-3xl mr-auto ml-4"
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="flex shrink-0 flex-col items-center mt-1">
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-offset-2 ring-offset-background ring-emerald-500/30 shadow-md">
              <Bot className="h-5 w-5" />
            </div>
            <motion.div
              className="absolute -right-1 -top-1"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Sparkles className="h-3 w-3 text-yellow-400" />
            </motion.div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-emerald-500">Agent</span>
            <span className="text-xs text-muted-foreground">
              {activeStep ? activeStep.label : 'Thinking'}
              <ThinkingDots />
            </span>
          </div>

          {/* Current tool badge */}
          <AnimatePresence>
            {currentTool && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-medium text-primary"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                Running: {currentTool}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress bar */}
          <div className="mb-3 h-1 w-full max-w-xs rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary"
              initial={{ width: '0%' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          {/* Steps list (collapsible) */}
          {steps.length > 0 && (
            <div>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowDetails(!showDetails)}
              >
                <ChevronDown
                  className={cn(
                    'h-3 w-3 transition-transform duration-200',
                    !showDetails && '-rotate-90'
                  )}
                />
                Steps ({completedCount}/{steps.length})
              </button>

              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <ul className="mt-2 space-y-1.5">
                      {steps.map((step, idx) => (
                        <motion.li
                          key={step.id ?? idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex items-center gap-2 text-xs"
                        >
                          <StepStatusIcon status={step.status} />
                          <span
                            className={cn(
                              'transition-colors',
                              step.status === 'active' && 'text-foreground font-medium',
                              step.status === 'done' && 'text-muted-foreground line-through',
                              step.status === 'pending' && 'text-muted-foreground/60',
                              step.status === 'error' && 'text-red-400'
                            )}
                          >
                            {step.label}
                          </span>
                        </motion.li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
