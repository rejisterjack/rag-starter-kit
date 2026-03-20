'use client';

import { Calculator, Globe, HelpCircle, Search, Sparkles, Zap } from 'lucide-react';
import type React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { QueryType } from '@/lib/rag/agent';
import { cn } from '@/lib/utils';

/** Query classification with metadata */
export interface QueryClassification {
  /** The classification type */
  type: QueryType;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reasoning for the classification */
  reasoning?: string;
  /** Suggested tools for this query type */
  suggestedTools?: string[];
}

export interface QueryClassificationBadgeProps {
  /** The classification data */
  classification: QueryClassification;
  /** Whether to show the confidence score */
  showConfidence?: boolean;
  /** Whether to show the tooltip */
  showTooltip?: boolean;
  /** Size variant */
  size?: 'sm' | 'default';
  /** Optional className for styling */
  className?: string;
}

/**
 * Badge component showing query classification type
 * Color-coded by type (DIRECT_ANSWER, RETRIEVE, CALCULATE, WEB_SEARCH, CLARIFY)
 */
export function QueryClassificationBadge({
  classification,
  showConfidence = false,
  showTooltip = true,
  size = 'default',
  className,
}: QueryClassificationBadgeProps) {
  const config = getQueryTypeConfig(classification.type);
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 font-medium',
        config.color,
        size === 'sm' && 'h-5 text-[10px] px-1.5',
        className
      )}
    >
      <Icon className={cn(size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3')} />
      <span>{config.label}</span>
      {showConfidence && (
        <span className="opacity-70">{Math.round(classification.confidence * 100)}%</span>
      )}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="font-medium">{config.label}</span>
              <span className="text-xs opacity-70 ml-auto">
                {Math.round(classification.confidence * 100)}% confidence
              </span>
            </div>
            {classification.reasoning && (
              <p className="text-xs opacity-90">{classification.reasoning}</p>
            )}
            {classification.suggestedTools && classification.suggestedTools.length > 0 && (
              <div className="pt-1 border-t border-border/50">
                <span className="text-[10px] opacity-70">Suggested tools:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {classification.suggestedTools.map((tool) => (
                    <span
                      key={tool}
                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-background/20"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface QueryTypeConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
}

function getQueryTypeConfig(type: QueryType): QueryTypeConfig {
  switch (type) {
    case QueryType.DIRECT_ANSWER:
      return {
        label: 'Direct Answer',
        icon: Zap,
        color:
          'border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200',
        description: 'Simple question that can be answered directly without document retrieval',
      };
    case QueryType.RETRIEVE:
      return {
        label: 'Retrieve',
        icon: Search,
        color:
          'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200',
        description: 'Question that requires searching through uploaded documents',
      };
    case QueryType.CALCULATE:
      return {
        label: 'Calculate',
        icon: Calculator,
        color:
          'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
        description: 'Question requiring mathematical calculations or data processing',
      };
    case QueryType.WEB_SEARCH:
      return {
        label: 'Web Search',
        icon: Globe,
        color:
          'border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-200',
        description: 'Question requiring current or external information from the web',
      };
    case QueryType.CLARIFY:
      return {
        label: 'Clarify',
        icon: HelpCircle,
        color:
          'border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200',
        description: 'Vague, ambiguous, or incomplete query that needs more information',
      };
    default:
      return {
        label: 'Unknown',
        icon: Sparkles,
        color: 'border-gray-200 bg-gray-100 text-gray-800',
        description: 'Unknown query type',
      };
  }
}

/**
 * Compact dot indicator for query classification
 */
export function QueryClassificationDot({
  type,
  className,
}: {
  type: QueryType;
  className?: string;
}) {
  const config = getQueryTypeConfig(type);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              type === QueryType.DIRECT_ANSWER && 'bg-green-500',
              type === QueryType.RETRIEVE && 'bg-blue-500',
              type === QueryType.CALCULATE && 'bg-amber-500',
              type === QueryType.WEB_SEARCH && 'bg-purple-500',
              type === QueryType.CLARIFY && 'bg-orange-500',
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Skeleton loader for classification badge
 */
export function QueryClassificationBadgeSkeleton({ className }: { className?: string }) {
  return <div className={cn('h-5 w-24 animate-pulse rounded-full bg-muted', className)} />;
}
