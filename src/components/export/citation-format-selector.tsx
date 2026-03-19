'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info, Hash, Footprints, BookOpen, GraduationCap, ListOrdered } from 'lucide-react';

import type { CitationStyle } from '@/lib/export';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface CitationFormatSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export interface CitationFormatOption {
  value: CitationStyle;
  label: string;
  description: string;
  example: string;
  icon: React.ReactNode;
}

// =============================================================================
// Options
// =============================================================================

const citationOptions: CitationFormatOption[] = [
  {
    value: 'inline-numbered',
    label: 'Inline Numbered',
    description: 'Simple bracketed numbers [1], [2], [3]',
    example: 'According to recent studies [1], the results show significant improvement.',
    icon: <Hash className="h-4 w-4" />,
  },
  {
    value: 'footnotes',
    label: 'Footnotes',
    description: 'Superscript numbers with footnotes at page bottom',
    example: 'According to recent studies¹, the results show significant improvement.',
    icon: <Footprints className="h-4 w-4" />,
  },
  {
    value: 'endnotes',
    label: 'Endnotes',
    description: 'Superscript numbers with notes at document end',
    example: 'According to recent studies¹, the results show significant improvement.',
    icon: <ListOrdered className="h-4 w-4" />,
  },
  {
    value: 'harvard',
    label: 'Harvard Style',
    description: 'Author-date format (Author, Year)',
    example: 'According to Smith (2023), the results show significant improvement.',
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    value: 'apa',
    label: 'APA (Simplified)',
    description: 'American Psychological Association format',
    example: 'According to Smith (2023), the results show significant improvement.',
    icon: <GraduationCap className="h-4 w-4" />,
  },
];

// =============================================================================
// Component
// =============================================================================

export function CitationFormatSelector({
  value,
  onChange,
  className,
  disabled = false,
}: CitationFormatSelectorProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Citation Style</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p>Choose how source citations appear in your exported document.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <RadioGroup
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        className="grid gap-2"
      >
        {citationOptions.map((option) => (
          <label
            key={option.value}
            htmlFor={option.value}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
              value === option.value
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/30 hover:bg-muted/50',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <RadioGroupItem
              value={option.value}
              id={option.value}
              className="mt-0.5"
              disabled={disabled}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'p-1.5 rounded-md',
                    value === option.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {option.icon}
                </span>
                <span className="font-medium">{option.label}</span>
              </div>

              <p className="text-sm text-muted-foreground mt-1">
                {option.description}
              </p>

              {value === option.value && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground border border-border">
                  <span className="font-medium">Example: </span>
                  {option.example}
                </div>
              )}
            </div>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

// =============================================================================
// Compact Variant
// =============================================================================

export interface CompactCitationFormatSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function CompactCitationFormatSelector({
  value,
  onChange,
  className,
  disabled = false,
}: CompactCitationFormatSelectorProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-xs font-medium">Citation Style</Label>

      <div className="flex flex-wrap gap-2">
        {citationOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => !disabled && onChange(option.value)}
            disabled={disabled}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
              value === option.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            title={option.description}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Preview Component
// =============================================================================

export interface CitationPreviewProps {
  style: CitationStyle;
  citations: Array<{
    id: string;
    documentName: string;
    page?: number;
    content: string;
  }>;
  className?: string;
}

export function CitationPreview({ style, citations, className }: CitationPreviewProps) {
  const formatCitation = (
    citation: { documentName: string; page?: number },
    index: number
  ): string => {
    switch (style) {
      case 'harvard':
        return `${citation.documentName}${citation.page ? `, p. ${citation.page}` : ''}`;
      case 'apa':
        return `${citation.documentName}${citation.page ? `, p. ${citation.page}` : ''}.`;
      case 'footnotes':
      case 'endnotes':
        return `[^${index + 1}]: ${citation.documentName}${citation.page ? `, Page ${citation.page}` : ''}`;
      case 'inline-numbered':
      default:
        return `[${index + 1}] ${citation.documentName}${citation.page ? `, Page ${citation.page}` : ''}`;
    }
  };

  const getInlineCitation = (index: number): string => {
    switch (style) {
      case 'harvard':
      case 'apa':
        return '(Author, Year)';
      case 'footnotes':
      case 'endnotes':
        return `${index + 1}`;
      case 'inline-numbered':
      default:
        return `[${index + 1}]`;
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <Label className="text-xs font-medium text-muted-foreground">Preview</Label>

      <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
        <p>
          The research findings indicate significant improvements in efficiency
          {citations.length > 0 && (
            <span className="text-primary font-medium">
              {' '}{getInlineCitation(0)}
            </span>
          )}. These results are consistent with previous studies
          {citations.length > 1 && (
            <span className="text-primary font-medium">
              {' '}{getInlineCitation(1)}
            </span>
          )}.
        </p>

        {(style === 'footnotes' || style === 'endnotes') && citations.length > 0 && (
          <div className="pt-2 border-t border-border/50 space-y-1 text-xs text-muted-foreground">
            {citations.slice(0, 2).map((citation, index) => (
              <p key={citation.id}>{formatCitation(citation, index)}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CitationFormatSelector;
