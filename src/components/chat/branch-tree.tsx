'use client';

import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  GitBranch,
  GitCommit,
  MessageSquare,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { BranchTreeNode, ConversationBranch } from '@/hooks/use-conversation-branch';
import { cn, formatRelativeTime } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface BranchTreeProps {
  branches: ConversationBranch[];
  branchTree: BranchTreeNode[];
  activeBranchId: string | null;
  onSwitchBranch: (branchId: string) => void;
  onDeleteBranch?: (branchId: string) => Promise<boolean>;
  onRenameBranch?: (branchId: string, newName: string) => Promise<boolean>;
  onCompareBranches?: (branchAId: string, branchBId: string) => void;
  className?: string;
  maxHeight?: string;
}

interface BranchNodeProps {
  node: BranchTreeNode;
  activeBranchId: string | null;
  level: number;
  expandedNodes: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  onSwitchBranch: (branchId: string) => void;
  onDeleteBranch?: (branchId: string) => Promise<boolean>;
  onRenameBranch?: (branchId: string, newName: string) => Promise<boolean>;
  onCompareBranches?: (branchAId: string, branchBId: string) => void;
  allBranches: ConversationBranch[];
}

// =============================================================================
// Branch Node Component
// =============================================================================

function BranchNode({
  node,
  activeBranchId,
  level,
  expandedNodes,
  onToggleExpand,
  onSwitchBranch,
  onDeleteBranch,
  onRenameBranch,
  onCompareBranches,
  allBranches,
}: BranchNodeProps) {
  const isActive = node.id === activeBranchId;
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children.length > 0;
  const isRoot = !node.parentId;

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);

  const handleRename = async () => {
    if (newName.trim() && newName !== node.name && onRenameBranch) {
      const success = await onRenameBranch(node.id, newName.trim());
      if (success) {
        setIsRenaming(false);
      }
    } else {
      setIsRenaming(false);
      setNewName(node.name);
    }
  };

  const handleDelete = async () => {
    if (onDeleteBranch && !isRoot) {
      await onDeleteBranch(node.id);
    }
  };

  // Indentation based on level
  const indentStyle = { paddingLeft: `${level * 16 + 8}px` };

  return (
    <div className="select-none">
      <button
        type="button"
        className={cn(
          'group flex items-center gap-1 py-2 pr-2 rounded-md transition-colors cursor-pointer w-full text-left',
          isActive
            ? 'bg-primary/10 border-l-2 border-primary'
            : 'hover:bg-muted border-l-2 border-transparent'
        )}
        style={indentStyle}
        onClick={() => onSwitchBranch(node.id)}
      >
        {/* Expand/Collapse button */}
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0 hover:bg-muted-foreground/20"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </Button>
        ) : (
          <div className="w-5" />
        )}

        {/* Branch icon */}
        <div className="flex-shrink-0">
          {isRoot ? (
            <GitCommit className="h-4 w-4 text-primary" />
          ) : (
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Branch name */}
        <div className="flex-1 min-w-0 ml-1">
          {isRenaming ? (
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setIsRenaming(false);
                  setNewName(node.name);
                }
              }}
              autoFocus
              className="h-6 py-0 text-sm"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-sm truncate',
                  isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
                title={node.name}
              >
                {node.name}
              </span>
              {isActive && (
                <Badge variant="outline" className="text-[10px] h-4 px-1">
                  Active
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Message count */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                <span>{node.messageCount}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{node.messageCount} messages</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Created time */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                <Clock className="h-3 w-3" />
                <span className="hidden sm:inline">{formatRelativeTime(node.createdAt)}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Created {node.createdAt.toLocaleString()}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Actions menu */}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onSwitchBranch(node.id)}>
            <Check className="mr-2 h-4 w-4" />
            Switch to branch
          </DropdownMenuItem>

          {onRenameBranch && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
              }}
            >
              <Edit3 className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
          )}

          {onCompareBranches && allBranches.length > 1 && (
            <>
              <DropdownMenuSeparator />
              {allBranches
                .filter((b) => b.id !== node.id)
                .slice(0, 5)
                .map((otherBranch) => (
                  <DropdownMenuItem
                    key={otherBranch.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCompareBranches(node.id, otherBranch.id);
                    }}
                  >
                    <GitBranch className="mr-2 h-4 w-4" />
                    Compare with "{otherBranch.name}"
                  </DropdownMenuItem>
                ))}
            </>
          )}

          {!isRoot && onDeleteBranch && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete branch
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Render children */}
      {hasChildren && isExpanded && (
        <div className="mt-0.5">
          {node.children.map((child) => (
            <BranchNode
              key={child.id}
              node={child}
              activeBranchId={activeBranchId}
              level={level + 1}
              expandedNodes={expandedNodes}
              onToggleExpand={onToggleExpand}
              onSwitchBranch={onSwitchBranch}
              onDeleteBranch={onDeleteBranch}
              onRenameBranch={onRenameBranch}
              onCompareBranches={onCompareBranches}
              allBranches={allBranches}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Branch Tree Component
// =============================================================================

export function BranchTree({
  branches,
  branchTree,
  activeBranchId,
  onSwitchBranch,
  onDeleteBranch,
  onRenameBranch,
  onCompareBranches,
  className,
  maxHeight = '400px',
}: BranchTreeProps) {
  // Track expanded nodes - default to expanding all
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const allIds = new Set<string>();
    const collectIds = (nodes: BranchTreeNode[]) => {
      nodes.forEach((node) => {
        allIds.add(node.id);
        collectIds(node.children);
      });
    };
    collectIds(branchTree);
    return allIds;
  });

  // Branch to delete (for confirmation dialog)
  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);

  const handleToggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: BranchTreeNode[]) => {
      nodes.forEach((node) => {
        allIds.add(node.id);
        collectIds(node.children);
      });
    };
    collectIds(branchTree);
    setExpandedNodes(allIds);
  };

  const handleCollapseAll = () => {
    // Keep only root nodes expanded
    const rootIds = new Set(branchTree.map((n) => n.id));
    setExpandedNodes(rootIds);
  };

  if (branches.length === 0) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground', className)}>
        <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No branches yet</p>
        <p className="text-xs mt-1">Create a branch to explore different paths</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Conversation Tree</span>
          <Badge variant="secondary" className="text-[10px] h-5">
            {branches.length} {branches.length === 1 ? 'branch' : 'branches'}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleExpandAll}>
            Expand
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCollapseAll}>
            Collapse
          </Button>
        </div>
      </div>

      {/* Tree */}
      <div className="overflow-y-auto" style={{ maxHeight }}>
        {branchTree.map((node) => (
          <BranchNode
            key={node.id}
            node={node}
            activeBranchId={activeBranchId}
            level={0}
            expandedNodes={expandedNodes}
            onToggleExpand={handleToggleExpand}
            onSwitchBranch={onSwitchBranch}
            onDeleteBranch={onDeleteBranch}
            onRenameBranch={onRenameBranch}
            onCompareBranches={onCompareBranches}
            allBranches={branches}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="px-3 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <GitCommit className="h-3 w-3 text-primary" />
            <span>Root</span>
          </div>
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-3 w-3 text-muted-foreground" />
            <span>Branch</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-primary/10 border border-primary rounded-sm" />
            <span>Active</span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!branchToDelete} onOpenChange={() => setBranchToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Branch</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this branch? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (branchToDelete && onDeleteBranch) {
                  await onDeleteBranch(branchToDelete);
                  setBranchToDelete(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Branch Tree Panel Component (Sidebar version)
// =============================================================================

interface BranchTreePanelProps extends BranchTreeProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BranchTreePanel({ isOpen, onClose, ...branchTreeProps }: BranchTreePanelProps) {
  if (!isOpen) return null;

  return (
    <div className="w-80 border-l bg-background flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold">Branches</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <span className="sr-only">Close</span>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <title>Close</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        <BranchTree {...branchTreeProps} maxHeight="100%" />
      </div>
    </div>
  );
}

export default BranchTree;
