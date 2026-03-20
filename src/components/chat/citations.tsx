'use client';

import { ExternalLink, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface CitationLinkProps {
  index: number;
  onClick?: (index: number) => void;
}

export function CitationLink({ index, onClick }: CitationLinkProps) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <sup>
            <button
              onClick={() => onClick?.(index)}
              className={cn(
                'inline-flex items-center justify-center rounded-full',
                'min-w-[18px] h-[18px] px-1 mx-0.5',
                'text-[10px] font-semibold',
                'bg-primary/10 text-primary hover:bg-primary/20',
                'transition-colors cursor-pointer',
                'focus:outline-none focus:ring-2 focus:ring-primary/20'
              )}
              aria-label={`Citation ${index}`}
            >
              {index}
            </button>
          </sup>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">Click to view source [{index}]</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export interface Source {
  id: string;
  index: number;
  documentName: string;
  documentType: string;
  chunkText: string;
  pageNumber?: number;
  relevanceScore: number;
}

interface CitationListProps {
  sources: Source[];
  onSourceClick?: (source: Source) => void;
  className?: string;
}

export function CitationList({ sources, onSourceClick, className }: CitationListProps) {
  if (!sources.length) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <h4 className="text-sm font-semibold text-foreground">Sources</h4>
      <div className="space-y-2">
        {sources.map((source) => (
          <CitationCard key={source.id} source={source} onClick={() => onSourceClick?.(source)} />
        ))}
      </div>
    </div>
  );
}

interface CitationCardProps {
  source: Source;
  onClick?: () => void;
}

export function CitationCard({ source, onClick }: CitationCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative rounded-lg border bg-card p-3',
        'transition-all duration-200',
        'hover:border-primary/50 hover:shadow-sm',
        onClick && 'cursor-pointer'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Source number badge */}
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
          {source.index}
        </div>

        <div className="min-w-0 flex-1">
          {/* Document info */}
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs font-medium">{source.documentName}</span>
            {source.pageNumber && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                p.{source.pageNumber}
              </Badge>
            )}
          </div>

          {/* Chunk preview */}
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{source.chunkText}</p>

          {/* Relevance score */}
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/60 transition-all"
                style={{ width: `${source.relevanceScore * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">
              {Math.round(source.relevanceScore * 100)}%
            </span>
          </div>
        </div>

        {/* External link indicator */}
        {onClick && (
          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </div>
    </div>
  );
}
