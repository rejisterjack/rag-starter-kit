'use client';

import { ClipboardCopy, FileJson, FileText, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversationActionsProps {
  conversationId: string;
  title: string;
  isShared?: boolean;
  shareToken?: string;
  onExportMarkdown: (chatId: string, title: string) => void;
  onExportJson: (chatId: string, title: string) => void;
  onCopyShareLink: (shareToken: string) => void;
  onDelete: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConversationActions({
  conversationId,
  title,
  isShared,
  shareToken,
  onExportMarkdown,
  onExportJson,
  onCopyShareLink,
  onDelete,
}: ConversationActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-background/80">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-xl border border-border/30 shadow-lg p-1"
      >
        <DropdownMenuItem
          className="rounded-lg px-3 py-2 text-sm cursor-pointer gap-2"
          onClick={() => onExportMarkdown(conversationId, title)}
        >
          <FileText className="h-4 w-4" />
          Export as Markdown
        </DropdownMenuItem>

        <DropdownMenuItem
          className="rounded-lg px-3 py-2 text-sm cursor-pointer gap-2"
          onClick={() => onExportJson(conversationId, title)}
        >
          <FileJson className="h-4 w-4" />
          Export as JSON
        </DropdownMenuItem>

        {isShared && shareToken && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 text-sm cursor-pointer gap-2"
              onClick={() => onCopyShareLink(shareToken)}
            >
              <ClipboardCopy className="h-4 w-4" />
              Copy share link
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="rounded-lg px-3 py-2 text-sm cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
          Delete conversation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ConversationActions;
