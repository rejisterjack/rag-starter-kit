'use client';

import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Eye,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/** Represents a single step in the ReAct reasoning process */
export interface ReasoningStep {
  /** Step number (1-indexed) */
  step: number;
  /** The agent's thought/reasoning */
  thought: string;
  /** The action/tool being called */
  action: string;
  /** Input parameters for the action */
  actionInput: Record<string, unknown>;
  /** The observation/result from the action */
  observation: string;
  /** Timestamp when the step was completed */
  timestamp?: Date;
  /** Current status of the step */
  status?: 'pending' | 'thinking' | 'acting' | 'observing' | 'completed' | 'error';
  /** Error message if the step failed */
  error?: string;
}

export interface ReasoningStepsProps {
  /** Array of reasoning steps to display */
  steps: ReasoningStep[];
  /** Whether to show the steps in a card container */
  inCard?: boolean;
  /** Whether steps are collapsible */
  collapsible?: boolean;
  /** Default expanded state for all steps */
  defaultExpanded?: boolean;
  /** Optional className for styling */
  className?: string;
  /** Maximum height before scrolling */
  maxHeight?: number;
  /** Callback when a step is clicked */
  onStepClick?: (step: ReasoningStep) => void;
}

/**
 * Component to display ReAct agent reasoning steps
 * Shows tool calls, observations, and thoughts in a collapsible format
 */
export function ReasoningSteps({
  steps,
  inCard = true,
  collapsible = true,
  defaultExpanded = false,
  className,
  maxHeight = 400,
  onStepClick,
}: ReasoningStepsProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(
    defaultExpanded ? new Set(steps.map((s) => s.step)) : new Set()
  );

  const toggleStep = (stepNumber: number) => {
    if (!collapsible) return;
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepNumber)) {
      newExpanded.delete(stepNumber);
    } else {
      newExpanded.add(stepNumber);
    }
    setExpandedSteps(newExpanded);
  };

  const expandAll = () => setExpandedSteps(new Set(steps.map((s) => s.step)));
  const collapseAll = () => setExpandedSteps(new Set());

  const content = (
    <div className={cn('space-y-3', className)}>
      {/* Header with expand/collapse all */}
      {collapsible && steps.length > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Expand all
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Collapse all
          </button>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, index) => (
          <StepItem
            key={step.step}
            step={step}
            isExpanded={expandedSteps.has(step.step)}
            onToggle={() => toggleStep(step.step)}
            collapsible={collapsible}
            isLast={index === steps.length - 1}
            onClick={() => onStepClick?.(step)}
          />
        ))}
      </div>
    </div>
  );

  if (inCard) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            Reasoning Steps
            <Badge variant="secondary" className="ml-auto text-xs">
              {steps.length} step{steps.length !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className={maxHeight ? `max-h-[${maxHeight}px]` : undefined}>
            {content}
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  return content;
}

interface StepItemProps {
  step: ReasoningStep;
  isExpanded: boolean;
  onToggle: () => void;
  collapsible: boolean;
  isLast: boolean;
  onClick?: () => void;
}

function StepItem({
  step,
  isExpanded,
  onToggle,
  collapsible,
  isLast: _isLast,
  onClick,
}: StepItemProps) {
  const status = step.status || 'completed';
  const hasObservation = step.observation && step.observation.length > 0;

  const getStatusIcon = () => {
    switch (status) {
      case 'thinking':
        return <Brain className="h-3.5 w-3.5 text-blue-500 animate-pulse" />;
      case 'acting':
        return <Wrench className="h-3.5 w-3.5 text-amber-500 animate-pulse" />;
      case 'observing':
        return <Eye className="h-3.5 w-3.5 text-purple-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case 'error':
        return <Circle className="h-3.5 w-3.5 text-red-500" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'thinking':
        return 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30';
      case 'acting':
        return 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30';
      case 'observing':
        return 'border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/30';
      case 'completed':
        return 'border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30';
      case 'error':
        return 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30';
      default:
        return 'border-muted bg-muted/30';
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Interactive element with conditional role, tabIndex, and keyboard handler
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: Conditional ARIA props based on interactive state
    <div
      className={cn(
        'rounded-lg border transition-all',
        getStatusColor(),
        collapsible && 'cursor-pointer hover:border-primary/50',
        isExpanded && 'border-primary/50'
      )}
      onClick={collapsible ? () => {
        onToggle();
        onClick?.();
      } : undefined}
      onKeyDown={collapsible ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
          onClick?.();
        }
      } : undefined}
      role={collapsible ? 'button' : undefined}
      tabIndex={collapsible ? 0 : undefined}
      aria-expanded={collapsible ? isExpanded : undefined}
    >
      {/* Step Header */}
      <div className="flex items-center gap-2 p-3">
        {/* Status Icon */}
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background">
          {getStatusIcon()}
        </div>

        {/* Step Number and Action */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] shrink-0">
            Step {step.step}
          </Badge>
          <span className="truncate text-sm font-medium">
            {step.action === 'final_answer' ? 'Final Answer' : formatActionName(step.action)}
          </span>
        </div>

        {/* Expand/Collapse Icon */}
        {collapsible && (
          <div className="shrink-0 text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3">
          <Separator className="mb-3" />
          <div className="space-y-3">
            {/* Thought */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Brain className="h-3 w-3" />
                Thought
              </div>
              <p className="text-sm text-foreground pl-4.5">{step.thought}</p>
            </div>

            {/* Action Input (if not final answer) */}
            {step.action !== 'final_answer' && Object.keys(step.actionInput).length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Wrench className="h-3 w-3" />
                  Action Input
                </div>
                <pre className="text-xs bg-background/80 rounded p-2 overflow-x-auto">
                  {JSON.stringify(step.actionInput, null, 2)}
                </pre>
              </div>
            )}

            {/* Observation */}
            {hasObservation && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  Observation
                </div>
                <div className="text-sm text-foreground bg-background/80 rounded p-2">
                  {step.observation}
                </div>
              </div>
            )}

            {/* Error */}
            {step.error && (
              <div className="rounded-md bg-red-100 dark:bg-red-950/50 p-2 text-xs text-red-800 dark:text-red-200">
                Error: {step.error}
              </div>
            )}

            {/* Timestamp */}
            {step.timestamp && (
              <div className="text-[10px] text-muted-foreground text-right">
                {step.timestamp.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatActionName(action: string): string {
  if (!action || action === 'final_answer') return 'Final Answer';
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Compact version of reasoning steps for inline display
 */
export function ReasoningStepsCompact({
  steps,
  className,
}: {
  steps: ReasoningStep[];
  className?: string;
}) {
  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const currentStep = steps.find(
    (s) => s.status && ['thinking', 'acting', 'observing'].includes(s.status)
  );

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <Brain className="h-3 w-3" />
      <span>
        {currentStep
          ? `Step ${currentStep.step}: ${formatActionName(currentStep.action)}`
          : `${completedSteps} reasoning step${completedSteps !== 1 ? 's' : ''}`}
      </span>
      {currentStep && (
        <span className="inline-flex gap-0.5">
          <span className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <span className="h-1 w-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <span className="h-1 w-1 rounded-full bg-primary animate-bounce" />
        </span>
      )}
    </div>
  );
}
