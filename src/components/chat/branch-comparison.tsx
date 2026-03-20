'use client';

import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  GitCompare,
  Minus,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trophy,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { BranchComparison, ConversationBranch } from '@/hooks/use-conversation-branch';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Markdown } from './markdown';
import type { Message } from './message-item';

// =============================================================================
// Types
// =============================================================================

interface BranchComparisonViewProps {
  comparison: BranchComparison;
  branches: ConversationBranch[];
  onClose: () => void;
  onSwitchToBranch?: (branchId: string) => void;
  onVoteBranch?: (branchId: string, vote: 'up' | 'down') => void;
  className?: string;
}

interface Difference {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  messageA?: Message;
  messageB?: Message;
  description?: string;
}

// =============================================================================
// Diff Highlight Component
// =============================================================================

interface DiffHighlightProps {
  text: string;
  type: 'added' | 'removed' | 'unchanged';
  maxLength?: number;
}

function DiffHighlight({ text, type, maxLength = 200 }: DiffHighlightProps) {
  const truncated = text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;

  return (
    <span
      className={cn(
        'px-1 rounded',
        type === 'added' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
        type === 'removed' &&
          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 line-through',
        type === 'unchanged' && 'text-foreground'
      )}
    >
      {truncated}
    </span>
  );
}

// =============================================================================
// Message Diff Component
// =============================================================================

interface MessageDiffProps {
  messageA?: Message;
  messageB?: Message;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  isHighlighted?: boolean;
}

function MessageDiff({ messageA, messageB, type, isHighlighted }: MessageDiffProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const getIcon = () => {
    switch (type) {
      case 'added':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'removed':
        return <Minus className="h-4 w-4 text-red-500" />;
      case 'modified':
        return <Edit3 className="h-4 w-4 text-yellow-500" />;
      default:
        return <div className="h-4 w-4" />;
    }
  };

  const getBadge = () => {
    switch (type) {
      case 'added':
        return (
          <Badge variant="success" className="text-[10px]">
            Added
          </Badge>
        );
      case 'removed':
        return (
          <Badge variant="destructive" className="text-[10px]">
            Removed
          </Badge>
        );
      case 'modified':
        return (
          <Badge variant="warning" className="text-[10px]">
            Modified
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden transition-colors',
        isHighlighted && 'ring-2 ring-primary ring-offset-1',
        type === 'added' && 'border-green-200 dark:border-green-800',
        type === 'removed' && 'border-red-200 dark:border-red-800',
        type === 'modified' && 'border-yellow-200 dark:border-yellow-800',
        type === 'unchanged' && 'border-border'
      )}
    >
      <button
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
        {getIcon()}
        <span className="text-sm font-medium">
          {messageA?.role === 'user' || messageB?.role === 'user' ? 'User' : 'Assistant'}
        </span>
        {getBadge()}
        <span className="ml-auto text-xs text-muted-foreground">
          {type === 'modified' ? 'Content differs' : ''}
        </span>
      </button>

      {isExpanded && (
        <div className="p-3">
          {type === 'modified' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Original</span>
                <div className="text-sm">
                  {messageA ? (
                    <DiffHighlight text={messageA.content} type="removed" />
                  ) : (
                    <span className="text-muted-foreground italic">No message</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Modified</span>
                <div className="text-sm">
                  {messageB ? (
                    <DiffHighlight text={messageB.content} type="added" />
                  ) : (
                    <span className="text-muted-foreground italic">No message</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm">
              <Markdown
                content={type === 'removed' ? messageA?.content || '' : messageB?.content || ''}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Branch Comparison Component
// =============================================================================

export function BranchComparisonView({
  comparison,
  branches,
  onClose,
  onSwitchToBranch,
  onVoteBranch,
  className,
}: BranchComparisonViewProps) {
  const [selectedTab, setSelectedTab] = useState<'side-by-side' | 'diff'>('diff');
  const [votes, setVotes] = useState<Record<string, 'up' | 'down'>>({});

  const branchA = branches.find((b) => b.id === comparison.branchA.id);
  const branchB = branches.find((b) => b.id === comparison.branchB.id);

  // Calculate differences
  const differences = useMemo<Difference[]>(() => {
    const diffs: Difference[] = [];
    const messagesA = comparison.branchA.messages;
    const messagesB = comparison.branchB.messages;

    // Simple diff algorithm - align by index for now
    const maxLength = Math.max(messagesA.length, messagesB.length);

    for (let i = 0; i < maxLength; i++) {
      const msgA = messagesA[i];
      const msgB = messagesB[i];

      if (!msgA && msgB) {
        diffs.push({ type: 'added', messageB: msgB });
      } else if (msgA && !msgB) {
        diffs.push({ type: 'removed', messageA: msgA });
      } else if (msgA && msgB) {
        if (msgA.content !== msgB.content || msgA.role !== msgB.role) {
          diffs.push({ type: 'modified', messageA: msgA, messageB: msgB });
        } else {
          diffs.push({ type: 'unchanged', messageA: msgA, messageB: msgB });
        }
      }
    }

    return diffs;
  }, [comparison]);

  const significantDifferences = differences.filter((d) => d.type !== 'unchanged');

  const handleVote = (branchId: string, vote: 'up' | 'down') => {
    setVotes((prev) => ({ ...prev, [branchId]: vote }));
    onVoteBranch?.(branchId, vote);
  };

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              Branch Comparison
            </h2>
            <p className="text-sm text-muted-foreground">
              Comparing {significantDifferences.length} differences
            </p>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as typeof selectedTab)}>
          <TabsList>
            <TabsTrigger value="diff">Differences</TabsTrigger>
            <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {selectedTab === 'diff' ? (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4 max-w-4xl mx-auto">
              {/* Summary Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Comparison Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {differences.filter((d) => d.type === 'added').length}
                      </div>
                      <div className="text-xs text-muted-foreground">Added</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-red-600">
                        {differences.filter((d) => d.type === 'removed').length}
                      </div>
                      <div className="text-xs text-muted-foreground">Removed</div>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">
                        {differences.filter((d) => d.type === 'modified').length}
                      </div>
                      <div className="text-xs text-muted-foreground">Modified</div>
                    </div>
                  </div>

                  {comparison.divergencePoint && (
                    <div className="mt-4 p-3 bg-primary/5 rounded-lg">
                      <p className="text-sm">
                        <span className="font-medium">Divergence point:</span> Messages started
                        differing at this point
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Differences List */}
              <div className="space-y-3">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Differences
                </h3>
                {significantDifferences.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>No significant differences found</p>
                  </div>
                ) : (
                  significantDifferences.map((diff, index) => (
                    <MessageDiff
                      key={index}
                      messageA={diff.messageA}
                      messageB={diff.messageB}
                      type={diff.type}
                      isHighlighted={
                        (diff.messageA?.id || diff.messageB?.id) === comparison.divergencePoint
                      }
                    />
                  ))
                )}
              </div>
            </div>
          </ScrollArea>
        ) : (
          /* Side by Side View */
          <div className="h-full grid grid-cols-2 divide-x">
            {/* Branch A */}
            <div className="flex flex-col">
              <div className="px-4 py-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      {branchA?.name || 'Branch A'}
                      <Badge variant="outline" className="text-[10px]">
                        A
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {comparison.branchA.messages.length} messages
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              'h-8 w-8',
                              votes[comparison.branchA.id] === 'up' && 'text-green-600'
                            )}
                            onClick={() => handleVote(comparison.branchA.id, 'up')}
                          >
                            <ThumbsUp className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Vote this branch as better</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              'h-8 w-8',
                              votes[comparison.branchA.id] === 'down' && 'text-red-600'
                            )}
                            onClick={() => handleVote(comparison.branchA.id, 'down')}
                          >
                            <ThumbsDown className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Vote this branch as worse</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {comparison.branchA.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'p-3 rounded-lg',
                        message.role === 'user'
                          ? 'bg-muted ml-4'
                          : 'bg-primary/5 mr-4 border border-primary/10'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-[10px]">
                          {message.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(message.createdAt)}
                        </span>
                      </div>
                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                        <Markdown content={message.content} />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {onSwitchToBranch && (
                <div className="p-3 border-t">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => onSwitchToBranch(comparison.branchA.id)}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Switch to Branch A
                  </Button>
                </div>
              )}
            </div>

            {/* Branch B */}
            <div className="flex flex-col">
              <div className="px-4 py-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      {branchB?.name || 'Branch B'}
                      <Badge variant="outline" className="text-[10px]">
                        B
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {comparison.branchB.messages.length} messages
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              'h-8 w-8',
                              votes[comparison.branchB.id] === 'up' && 'text-green-600'
                            )}
                            onClick={() => handleVote(comparison.branchB.id, 'up')}
                          >
                            <ThumbsUp className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Vote this branch as better</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              'h-8 w-8',
                              votes[comparison.branchB.id] === 'down' && 'text-red-600'
                            )}
                            onClick={() => handleVote(comparison.branchB.id, 'down')}
                          >
                            <ThumbsDown className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Vote this branch as worse</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {comparison.branchB.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'p-3 rounded-lg',
                        message.role === 'user'
                          ? 'bg-muted ml-4'
                          : 'bg-primary/5 mr-4 border border-primary/10'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-[10px]">
                          {message.role}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(message.createdAt)}
                        </span>
                      </div>
                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                        <Markdown content={message.content} />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {onSwitchToBranch && (
                <div className="p-3 border-t">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => onSwitchToBranch(comparison.branchB.id)}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Switch to Branch B
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Compact Comparison Badge
// =============================================================================

interface CompactComparisonBadgeProps {
  differenceCount: number;
  onClick: () => void;
}

export function CompactComparisonBadge({ differenceCount, onClick }: CompactComparisonBadgeProps) {
  return (
    <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={onClick}>
      <GitCompare className="h-4 w-4" />
      <span>{differenceCount} differences</span>
    </Button>
  );
}

// =============================================================================
// Branch Winner Badge
// =============================================================================

interface BranchWinnerBadgeProps {
  winnerId: string;
  branches: ConversationBranch[];
}

export function BranchWinnerBadge({ winnerId, branches }: BranchWinnerBadgeProps) {
  const winner = branches.find((b) => b.id === winnerId);

  if (!winner) return null;

  return (
    <Badge
      variant="default"
      className="gap-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-white"
    >
      <Trophy className="h-3 w-3" />
      Winner: {winner.name}
    </Badge>
  );
}

export default BranchComparisonView;
