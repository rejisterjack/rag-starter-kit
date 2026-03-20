"use client";

import React, { useState } from "react";
import {
  Copy,
  Check,
  Pencil,
  Trash2,
  GitBranch,
  Sparkles,
  MoreHorizontal,
  CornerUpRight,
  GitCompare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// =============================================================================
// Types
// =============================================================================

interface MessageActionsProps {
  messageId: string;
  messageContent: string;
  messageRole: "user" | "assistant" | "system";
  isEditing?: boolean;
  isForking?: boolean;
  showBranchActions?: boolean;
  onCopy?: () => void;
  onEdit?: (newContent: string) => void;
  onDelete?: () => void;
  onBranch?: () => void;
  onBranchWithName?: (branchName?: string) => Promise<void>;
  onEditAndRegenerate?: (newContent: string, regenerateResponse?: boolean) => Promise<void>;
  onCompare?: () => void;
  className?: string;
}

// =============================================================================
// Message Actions Component
// =============================================================================

export function MessageActions({
  messageId: _messageId,
  messageContent,
  messageRole,
  isEditing: _isEditing = false,
  isForking = false,
  showBranchActions = true,
  onCopy,
  onEdit,
  onDelete,
  onBranch,
  onBranchWithName,
  onEditAndRegenerate,
  onCompare,
  className,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [editedContent, setEditedContent] = useState(messageContent);
  const [branchName, setBranchName] = useState("");
  const [regenerateResponse, setRegenerateResponse] = useState(true);

  const isUser = messageRole === "user";
  const isAssistant = messageRole === "assistant";

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleCopy = async () => {
    if (onCopy) {
      onCopy();
    } else {
      await navigator.clipboard.writeText(messageContent);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(editedContent);
      setIsEditDialogOpen(false);
    }
  };

  const handleEditAndRegenerate = async () => {
    if (onEditAndRegenerate) {
      await onEditAndRegenerate(editedContent, regenerateResponse);
      setIsEditDialogOpen(false);
    }
  };

  const handleBranch = async () => {
    if (onBranchWithName) {
      await onBranchWithName(branchName.trim() || undefined);
      setIsBranchDialogOpen(false);
      setBranchName("");
    } else if (onBranch) {
      onBranch();
      setIsBranchDialogOpen(false);
    }
  };

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <TooltipProvider>
        {/* Copy Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{copied ? "Copied!" : "Copy message"}</p>
          </TooltipContent>
        </Tooltip>

        {/* More Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* Edit for user messages */}
            {isUser && onEdit && (
              <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit message
              </DropdownMenuItem>
            )}

            {/* Branch actions */}
            {showBranchActions && (
              <>
                {(isUser || isAssistant) && (
                  <DropdownMenuItem
                    onClick={() => setIsBranchDialogOpen(true)}
                    disabled={isForking}
                  >
                    {isForking ? (
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <GitBranch className="mr-2 h-4 w-4" />
                    )}
                    Create branch from here
                  </DropdownMenuItem>
                )}

                {/* Edit and regenerate for user messages */}
                {isUser && onEditAndRegenerate && (
                  <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
                    <CornerUpRight className="mr-2 h-4 w-4" />
                    Edit & regenerate
                  </DropdownMenuItem>
                )}

                {/* Compare branches */}
                {onCompare && (
                  <DropdownMenuItem onClick={onCompare}>
                    <GitCompare className="mr-2 h-4 w-4" />
                    Compare branches
                  </DropdownMenuItem>
                )}
              </>
            )}

            {/* Delete */}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete message
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Message
            </DialogTitle>
            <DialogDescription>
              {onEditAndRegenerate
                ? "Edit your message and optionally regenerate the AI response."
                : "Edit your message."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[120px] resize-y"
              placeholder="Enter your message..."
            />
            
            {onEditAndRegenerate && isUser && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <Switch
                    id="regenerate"
                    checked={regenerateResponse}
                    onCheckedChange={setRegenerateResponse}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="regenerate" className="cursor-pointer">
                      Regenerate response
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Create a new branch with updated AI response
                    </p>
                  </div>
                </div>
                {regenerateResponse && (
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            {onEditAndRegenerate ? (
              <Button 
                onClick={handleEditAndRegenerate}
                disabled={!editedContent.trim() || editedContent === messageContent}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {regenerateResponse ? "Edit & Regenerate" : "Save Edit"}
              </Button>
            ) : (
              <Button 
                onClick={handleEdit}
                disabled={!editedContent.trim() || editedContent === messageContent}
              >
                <Check className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch Dialog */}
      <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Create New Branch
            </DialogTitle>
            <DialogDescription>
              Create a new conversation branch starting from this message. 
              This message and all following messages will be copied to the new branch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch Name (optional)</Label>
              <input
                id="branch-name"
                type="text"
                className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                placeholder="e.g., Alternative approach, Testing variation..."
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for an auto-generated name
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBranchDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBranch} disabled={isForking}>
              {isForking ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <GitBranch className="mr-2 h-4 w-4" />
                  Create Branch
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
// Enhanced Message Actions Bar
// =============================================================================

interface MessageActionsBarProps {
  messageId: string;
  messageContent: string;
  messageRole: "user" | "assistant" | "system";
  messageIndex: number;
  totalMessages: number;
  onCopy?: () => void;
  onEdit?: (newContent: string) => void;
  onDelete?: () => void;
  onBranch?: () => void;
  onBranchWithName?: (branchName?: string) => Promise<void>;
  onEditAndRegenerate?: (newContent: string, regenerateResponse?: boolean) => Promise<void>;
  onRegenerateFromHere?: () => void;
  onCompare?: () => void;
  className?: string;
}

export function MessageActionsBar({
  messageId: _messageId,
  messageContent,
  messageRole,
  messageIndex,
  totalMessages,
  onCopy,
  onEdit,
  onDelete,
  onBranch,
  onBranchWithName,
  onEditAndRegenerate,
  onRegenerateFromHere,
  onCompare,
  className,
}: MessageActionsBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (onCopy) {
      onCopy();
    } else {
      await navigator.clipboard.writeText(messageContent);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLastMessage = messageIndex === totalMessages - 1;
  const isUser = messageRole === "user";

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1", className)}>
        {/* Copy */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{copied ? "Copied!" : "Copy"}</p>
          </TooltipContent>
        </Tooltip>

        {/* Edit - for user messages */}
        {isUser && onEdit && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(messageContent)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit message</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Branch from here */}
        {onBranchWithName && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBranch}>
                <GitBranch className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Create branch from here</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Regenerate from here - for user messages */}
        {isUser && onEditAndRegenerate && !isLastMessage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEditAndRegenerate(messageContent, true)}
              >
                <CornerUpRight className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Edit & regenerate from here</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Regenerate - for last assistant message */}
        {!isUser && onRegenerateFromHere && isLastMessage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRegenerateFromHere}>
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Regenerate response</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Compare */}
        {onCompare && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCompare}>
                <GitCompare className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Compare branches</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Delete */}
        {onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete message</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

export default MessageActions;
