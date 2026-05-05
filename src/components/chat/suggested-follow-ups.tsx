'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { memo } from 'react';
import { Button } from '@/components/ui/button';

interface SuggestedFollowUpsProps {
  questions: string[];
  onSelect: (question: string) => void;
  className?: string;
}

export const SuggestedFollowUps = memo(function SuggestedFollowUps({
  questions,
  onSelect,
  className,
}: SuggestedFollowUpsProps) {
  if (!questions || questions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.25, ease: 'easeOut' }}
      className={`mt-3 pt-3 border-t border-border/40 ${className ?? ''}`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="h-3 w-3 text-primary/70" />
        <span className="text-xs text-muted-foreground font-medium">Suggested follow-ups</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {questions.map((q) => (
          <Button
            key={q}
            variant="outline"
            size="sm"
            className="h-auto py-1.5 px-3 text-xs font-normal text-left whitespace-normal leading-snug
                       border-border/60 hover:border-primary/50 hover:bg-primary/5 hover:text-primary
                       transition-colors duration-150 max-w-xs"
            onClick={() => onSelect(q)}
          >
            {q}
          </Button>
        ))}
      </div>
    </motion.div>
  );
});
