'use client';

import { Clock, FileText, MessageSquare, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ConversationActions } from './conversation-actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  isShared?: boolean;
  shareToken?: string;
}

export interface ConversationHistoryPanelProps {
  workspaceId?: string;
  currentChatId?: string;
  onSelectConversation: (chatId: string) => void;
  onDeleteConversation: (chatId: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function ConversationListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
        <div key={i} className="flex items-start gap-3 rounded-xl p-3">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyConversationState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">No conversations yet</h3>
      <p className="text-xs text-muted-foreground mb-4 max-w-[200px]">
        Start a new chat to begin a conversation with the AI assistant.
      </p>
      <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={onNewChat}>
        <Plus className="h-4 w-4" />
        New Chat
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// No search results
// ---------------------------------------------------------------------------

function NoSearchResults({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <Search className="h-8 w-8 text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground">
        No conversations matching &ldquo;{query}&rdquo;
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ConversationHistoryPanel({
  currentChatId,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
  isOpen,
  onClose,
}: ConversationHistoryPanelProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fetch conversations when the sheet opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/v1/chats?limit=50');
        if (!response.ok) throw new Error('Failed to fetch conversations');

        const json = await response.json();
        if (!cancelled) {
          setConversations(json.data as ConversationSummary[]);
        }
      } catch (_err) {
        if (!cancelled) {
          toast.error('Failed to load conversations');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  // Handlers
  const handleSelect = useCallback(
    (chatId: string) => {
      onSelectConversation(chatId);
      onClose();
    },
    [onSelectConversation, onClose]
  );

  const handleDelete = useCallback(
    async (chatId: string) => {
      try {
        const response = await fetch(`/api/v1/chats/${chatId}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete conversation');

        setConversations((prev) => prev.filter((c) => c.id !== chatId));
        onDeleteConversation(chatId);
        toast.success('Conversation deleted');
      } catch (_err) {
        toast.error('Failed to delete conversation');
      } finally {
        setDeleteConfirmId(null);
      }
    },
    [onDeleteConversation]
  );

  const handleExportMarkdown = useCallback(async (chatId: string, title: string) => {
    try {
      const response = await fetch(`/api/export/conversation?id=${chatId}&format=markdown`);
      if (!response.ok) throw new Error('Failed to export conversation');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}.md`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Exported as Markdown');
    } catch (_err) {
      toast.error('Failed to export conversation');
    }
  }, []);

  const handleExportJson = useCallback(async (chatId: string, title: string) => {
    try {
      const response = await fetch(`/api/export/conversation?id=${chatId}&format=json`);
      if (!response.ok) throw new Error('Failed to export conversation');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Exported as JSON');
    } catch (_err) {
      toast.error('Failed to export conversation');
    }
  }, []);

  const handleCopyShareLink = useCallback(async (shareToken: string) => {
    try {
      const url = `${window.location.origin}/share/${shareToken}`;
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard');
    } catch (_error: unknown) {
      toast.error('Failed to copy link');
    }
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="left"
        className="w-[85vw] sm:w-[400px] p-0 flex flex-col bg-background border-r border-border/40"
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b border-border/20">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Chat History
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Browse and manage your past conversations.
          </SheetDescription>
        </SheetHeader>

        {/* Search + New Chat row */}
        <div className="px-4 pt-3 pb-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-full bg-muted/50 border-border/30 focus-visible:ring-primary/40"
            />
          </div>

          <Button
            variant="default"
            size="sm"
            className="w-full gap-2 rounded-full"
            onClick={() => {
              onNewChat();
              onClose();
            }}
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <ConversationListSkeleton />
          ) : conversations.length === 0 ? (
            <EmptyConversationState onNewChat={onNewChat} />
          ) : filteredConversations.length === 0 ? (
            <NoSearchResults query={searchQuery} />
          ) : (
            <div className="px-2 pb-4 space-y-1">
              {filteredConversations.map((conversation) => {
                const isCurrentChat = conversation.id === currentChatId;
                const isConfirmingDelete = conversation.id === deleteConfirmId;

                return (
                  <button
                    type="button"
                    key={conversation.id}
                    className={cn(
                      'group relative flex items-start gap-3 rounded-xl px-3 py-3 transition-colors cursor-pointer text-left w-full',
                      isCurrentChat
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted/50 border border-transparent'
                    )}
                    onClick={() => handleSelect(conversation.id)}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        isCurrentChat
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            isCurrentChat ? 'text-primary' : 'text-foreground'
                          )}
                        >
                          {conversation.title}
                        </p>

                        {/* Actions - visible on hover */}
                        {/* biome-ignore lint/a11y/noStaticElementInteractions: wrapper for stopPropagation only */}
                        <div
                          role="presentation"
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ConversationActions
                            conversationId={conversation.id}
                            title={conversation.title}
                            isShared={conversation.isShared}
                            shareToken={conversation.shareToken}
                            onExportMarkdown={handleExportMarkdown}
                            onExportJson={handleExportJson}
                            onCopyShareLink={handleCopyShareLink}
                            onDelete={() => setDeleteConfirmId(conversation.id)}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(conversation.updatedAt)}
                        </span>
                        <span className="text-xs text-muted-foreground/60">·</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          {conversation.messageCount}
                        </span>
                      </div>
                    </div>

                    {/* Delete confirmation overlay */}
                    {isConfirmingDelete && (
                      /* biome-ignore lint/a11y/noStaticElementInteractions: overlay for stopPropagation only */
                      <div
                        role="presentation"
                        className="absolute inset-0 flex items-center justify-center gap-2 bg-background/95 backdrop-blur-sm rounded-xl z-10 border border-destructive/30"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-xs text-muted-foreground mr-1">Delete?</span>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs rounded-full px-3"
                          onClick={() => handleDelete(conversation.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs rounded-full px-3"
                          onClick={() => setDeleteConfirmId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default ConversationHistoryPanel;
