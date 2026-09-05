'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { memo, useState } from 'react';
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
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);

  if (!questions || questions.length === 0) return null;

  return (
    <div
      className={`mt-3 pt-3 border-t border-border/30 animate-fade-in-up [animation-delay:150ms] ${className ?? ''}`}
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
            disabled={!!selectedQuestion}
            className="h-auto py-1.5 px-3 text-xs font-normal text-left whitespace-normal leading-snug
                       rounded-full border-white/10 bg-background/40 hover:border-primary/40 hover:bg-primary/10 hover:text-primary
                       transition-colors duration-150 max-w-xs"
            onClick={() => {
              setSelectedQuestion(q);
              onSelect(q);
            }}
          >
            {selectedQuestion === q && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            {q}
          </Button>
        ))}
      </div>
    </div>
  );
});
