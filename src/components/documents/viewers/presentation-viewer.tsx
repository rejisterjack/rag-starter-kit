'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PresentationViewerProps {
  content: string;
  className?: string;
}

function parseSlides(content: string): { title: string; body: string }[] {
  const slides: { title: string; body: string }[] = [];
  const sections = content.split(/^##\s+Slide\s+\d+/im);

  if (sections.length <= 1) {
    const headingBlocks = content.split(/^(?=#{1,3}\s)/m).filter(Boolean);
    for (const block of headingBlocks) {
      const lines = block.trim().split('\n');
      const title = lines[0].replace(/^#+\s*/, '').trim();
      const body = lines.slice(1).join('\n').trim();
      slides.push({ title, body });
    }
  } else {
    for (const section of sections.slice(1)) {
      const lines = section.trim().split('\n');
      const title = lines[0].replace(/^#+\s*/, '').trim();
      const body = lines.slice(1).join('\n').trim();
      slides.push({ title: title || 'Untitled', body });
    }
  }

  if (slides.length === 0 && content.trim()) {
    slides.push({ title: 'Slide 1', body: content.trim() });
  }

  return slides;
}

export function PresentationViewer({ content, className }: PresentationViewerProps) {
  const slides = useMemo(() => parseSlides(content), [content]);
  const [current, setCurrent] = useState(0);

  if (slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No slides to display
      </div>
    );
  }

  const slide = slides[current];

  return (
    <div className={`flex flex-col h-full ${className ?? ''}`}>
      <div className="flex items-center justify-between px-4 py-1.5 border-b bg-muted/30">
        <span className="text-xs text-muted-foreground">
          Slide {current + 1} of {slides.length}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={current === 0}
            onClick={() => setCurrent((c) => c - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={current === slides.length - 1}
            onClick={() => setCurrent((c) => c + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex items-center justify-center min-h-full p-8">
          <div className="w-full max-w-2xl aspect-[16/9] bg-background border rounded-lg shadow-sm p-8 flex flex-col">
            <h3 className="text-xl font-semibold mb-4 text-center">{slide.title}</h3>
            <div className="flex-1 text-sm whitespace-pre-wrap break-words leading-relaxed">
              {slide.body}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
