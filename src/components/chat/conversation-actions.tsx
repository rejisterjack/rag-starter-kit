'use client';

import { ClipboardCopy, FileJson, FileText, Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
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
  isExporting?: boolean;
  isDeleting?: boolean;
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
  isExporting = false,
  isDeleting = false,
  onExportMarkdown,
  onExportJson,
  onCopyShareLink,
  onDelete,
}: ConversationActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full hover:bg-background/80"
          disabled={isDeleting}
        >
          {isExporting || isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-lg border border-white/10 bg-[#1a1a2e] shadow-2xl backdrop-blur-xl p-1"
      >
        <DropdownMenuItem
          className="rounded-lg px-3 py-2 text-sm cursor-pointer gap-2 focus:bg-white/8"
          disabled={isExporting}
          onClick={() => onExportMarkdown(conversationId, title)}
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          Export as Markdown
        </DropdownMenuItem>

        <DropdownMenuItem
          className="rounded-lg px-3 py-2 text-sm cursor-pointer gap-2 focus:bg-white/8"
          disabled={isExporting}
          onClick={() => onExportJson(conversationId, title)}
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileJson className="h-3.5 w-3.5" />
          )}
          Export as JSON
        </DropdownMenuItem>

        {isShared && shareToken && (
          <>
            <DropdownMenuSeparator className="bg-white/8 my-1" />
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 text-sm cursor-pointer gap-2 focus:bg-white/8"
              onClick={() => onCopyShareLink(shareToken)}
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
              Copy share link
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator className="bg-white/8 my-1" />

        <DropdownMenuItem
          className="rounded-lg px-3 py-2 text-sm cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete conversation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ConversationActions;
