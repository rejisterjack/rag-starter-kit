"use client";

import React, { useState } from "react";
import {
  GitBranch,
  GitCompare,
  Edit3,
  Sparkles,
  ChevronDown,
  Plus,
  ListTree,
  Check,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { ConversationBranch } from "@/hooks/use-conversation-branch";

// =============================================================================
// Types
// =============================================================================

interface BranchActionsProps {
  branches: ConversationBranch[];
  activeBranchId: string | null;
  currentMessageId?: string;
  isForking?: boolean;
  isEditing?: boolean;
  comparisonMode?: boolean;
  onCreateBranch?: (messageId: string, branchName?: string) => Promise<string | null>;
  onEditMessage?: (messageId: string, newContent: string, options?: { regenerateResponse?: boolean }) => Promise<string | null>;
  onToggleComparisonMode?: () => void;
  onSelectBranchForCompare?: (branchId: string, slot: 0 | 1) => void;
  onShowBranchTree?: () => void;
  className?: string;
}

// =============================================================================
// Branch Actions Component
// =============================================================================

export function BranchActions({
  branches,
  activeBranchId,
  currentMessageId,
  isForking = false,
  isEditing = false,
  comparisonMode = false,
  onCreateBranch,
  onEditMessage,
  onToggleComparisonMode,
  onSelectBranchForCompare,
  onShowBranchTree,
  className,
}: BranchActionsProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [regenerateResponse, setRegenerateResponse] = useState(true);

  const activeBranch = branches.find((b) => b.id === activeBranchId);
  const hasBranches = branches.length > 1;

  const handleCreateBranch = async () => {
    if (currentMessageId && onCreateBranch) {
      await onCreateBranch(currentMessageId, branchName.trim() || undefined);
      setIsCreateDialogOpen(false);
      setBranchName("");
    }
  };

  const handleEditMessage = async () => {
    if (currentMessageId && onEditMessage) {
      await onEditMessage(currentMessageId, editedContent, { regenerateResponse });
      setIsEditDialogOpen(false);
      setEditedContent("");
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <TooltipProvider>
        {/* Create Branch Button */}
        {currentMessageId && onCreateBranch && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setIsCreateDialogOpen(true)}
                disabled={isForking}
              >
                {isForking ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <GitBranch className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Branch</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Create new branch from this message</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Edit & Regenerate Button */}
        {currentMessageId && onEditMessage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8"
                onClick={() => setIsEditDialogOpen(true)}
                disabled={isEditing}
              >
                {isEditing ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Edit3 className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Edit</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit message and regenerate response</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Comparison Toggle */}
        {hasBranches && onToggleComparisonMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={comparisonMode ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "gap-1.5 h-8",
                  comparisonMode && "ring-2 ring-primary ring-offset-1"
                )}
                onClick={onToggleComparisonMode}
              >
                <GitCompare className="h-4 w-4" />
                <span className="hidden sm:inline">Compare</span>
                {comparisonMode && (
                  <Badge variant="outline" className="ml-1 h-4 text-[10px] px-1">
                    On
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle branch comparison mode</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Branch Selector Dropdown */}
        {hasBranches && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 h-8">
                <ListTree className="h-4 w-4" />
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {activeBranch?.name ?? "Select branch"}
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Switch Branch</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {branches.map((branch) => (
                <DropdownMenuItem
                  key={branch.id}
                  className={cn(
                    "flex items-center justify-between",
                    branch.id === activeBranchId && "bg-accent"
                  )}
                  onClick={() => onSelectBranchForCompare?.(branch.id, 0)}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm">{branch.name}</span>
                  </div>
                  {branch.id === activeBranchId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {onShowBranchTree && (
                <DropdownMenuItem onClick={onShowBranchTree}>
                  <ListTree className="mr-2 h-4 w-4" />
                  View full tree
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TooltipProvider>

      {/* Create Branch Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Create New Branch
            </DialogTitle>
            <DialogDescription>
              Create a new conversation branch starting from this message. The new branch will 
              include this message and all messages after it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch Name (optional)</Label>
              <Input
                id="branch-name"
                placeholder="e.g., Alternative approach"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If left empty, a default name will be generated.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBranch} disabled={isForking}>
              {isForking ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Branch
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Message Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Edit Message & Regenerate
            </DialogTitle>
            <DialogDescription>
              Edit your message and create a new branch with a regenerated response.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edited-content">New Message Content</Label>
              <textarea
                id="edited-content"
                className="w-full min-h-[100px] p-3 rounded-md border bg-background text-sm resize-y"
                placeholder="Enter your edited message..."
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="regenerate"
                  checked={regenerateResponse}
                  onCheckedChange={setRegenerateResponse}
                />
                <Label htmlFor="regenerate" className="cursor-pointer">
                  Regenerate AI response
                </Label>
              </div>
              {regenerateResponse && (
                <Sparkles className="h-4 w-4 text-yellow-500" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditMessage} disabled={isEditing || !editedContent.trim()}>
              {isEditing ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Edit & Regenerate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Branch Comparison Selector Component
// =============================================================================

interface BranchComparisonSelectorProps {
  branches: ConversationBranch[];
  selectedBranches: [string | null, string | null];
  onSelectBranch: (branchId: string, slot: 0 | 1) => void;
  onCompare: () => void;
  onCancel: () => void;
}

export function BranchComparisonSelector({
  branches,
  selectedBranches,
  onSelectBranch,
  onCompare,
  onCancel,
}: BranchComparisonSelectorProps) {
  const [branchA, branchB] = selectedBranches;
  const canCompare = branchA && branchB && branchA !== branchB;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-background border-t p-4 shadow-lg">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Compare Branches
          </h3>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Branch A Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Branch A</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">
                    {branchA ? branches.find((b) => b.id === branchA)?.name : "Select branch..."}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {branches.map((branch) => (
                  <DropdownMenuCheckboxItem
                    key={branch.id}
                    checked={branchA === branch.id}
                    onCheckedChange={() => onSelectBranch(branch.id, 0)}
                    disabled={branch.id === branchB}
                  >
                    {branch.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Branch B Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Branch B</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="truncate">
                    {branchB ? branches.find((b) => b.id === branchB)?.name : "Select branch..."}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                {branches.map((branch) => (
                  <DropdownMenuCheckboxItem
                    key={branch.id}
                    checked={branchB === branch.id}
                    onCheckedChange={() => onSelectBranch(branch.id, 1)}
                    disabled={branch.id === branchA}
                  >
                    {branch.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onCompare} disabled={!canCompare}>
            <GitCompare className="mr-2 h-4 w-4" />
            Compare
          </Button>
        </div>
      </div>
    </div>
  );
}

export default BranchActions;
