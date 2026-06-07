'use client';

import { CloudOff, FileText, Loader2, MessageSquare, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useConnectivity } from '@/hooks/use-connectivity';
import { useConversations } from '@/hooks/use-conversations';
import { cn } from '@/lib/utils';
import { ConversationActions } from './conversation-actions';

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  isShared?: boolean;
  shareToken?: string;
}

export interface ConversationHistoryListProps {
  currentChatId?: string;
  onSelectConversation: (chatId: string) => void;
  onDeleteConversation: (chatId: string) => void;
  onNewChat: () => void;
}

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

function ConversationListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {['conv-1', 'conv-2', 'conv-3', 'conv-4', 'conv-5', 'conv-6'].map((k) => (
        <div key={k} className="flex items-start gap-3 rounded-xl p-3">
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

export function ConversationHistoryList({
  currentChatId,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
}: ConversationHistoryListProps) {
  const {
    data: cachedConversations,
    isLoading: isOfflineLoading,
    isFromCache,
  } = useConversations({ limit: 50 });
  const [searchConversations, setSearchConversations] = useState<ConversationSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<'markdown' | 'json' | null>(null);
  const { isOffline, isLiefi } = useConnectivity();

  // Use cached data when not searching
  const conversations = searchQuery.trim() ? searchConversations : (cachedConversations ?? []);
  const isLoading = searchQuery.trim() ? isSearching : isOfflineLoading;

  // Debounced server-side search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCancelledRef = useRef(false);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    // No query = use cached data
    if (!searchQuery.trim()) {
      setSearchConversations([]);
      return;
    }

    // Debounce search queries (300ms)
    searchCancelledRef.current = false;
    searchTimerRef.current = setTimeout(async () => {
      if (searchCancelledRef.current) return;
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/v1/chats?limit=50&search=${encodeURIComponent(searchQuery.trim())}`
        );
        if (!response.ok) throw new Error('Search failed');
        const json = await response.json();
        if (!searchCancelledRef.current) setSearchConversations(json.data as ConversationSummary[]);
      } catch {
        if (!searchCancelledRef.current) toast.error('Search failed');
      } finally {
        if (!searchCancelledRef.current) setIsSearching(false);
      }
    }, 300);

    return () => {
      searchCancelledRef.current = true;
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  const handleSelect = useCallback(
    (chatId: string) => {
      onSelectConversation(chatId);
    },
    [onSelectConversation]
  );

  const handleDelete = useCallback(
    async (chatId: string) => {
      setDeletingId(chatId);
      try {
        const response = await fetch(`/api/chat?chatId=${encodeURIComponent(chatId)}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete conversation');

        setSearchConversations((prev: ConversationSummary[]) =>
          prev.filter((c) => c.id !== chatId)
        );
        onDeleteConversation(chatId);
        toast.success('Conversation deleted');
      } catch (_err) {
        toast.error('Failed to delete conversation');
      } finally {
        setDeletingId(null);
        setDeleteConfirmId(null);
      }
    },
    [onDeleteConversation]
  );

  const handleExportMarkdown = useCallback(async (chatId: string, title: string) => {
    setExportingFormat('markdown');
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
    } finally {
      setExportingFormat(null);
    }
  }, []);

  const handleExportJson = useCallback(async (chatId: string, title: string) => {
    setExportingFormat('json');
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
    } finally {
      setExportingFormat(null);
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

  return (
    <div className="flex h-full flex-col">
      {/* Search row */}
      <div className="shrink-0 px-3 pt-2.5 pb-2 space-y-2 border-b border-white/8">
        {/* Offline indicator */}
        {(isOffline || isLiefi) && !searchQuery.trim() && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-500">
            <CloudOff className="h-3 w-3 shrink-0" />
            <span className="flex-1 leading-tight">
              {isOffline ? 'Offline — cached data' : 'Slow connection — cached data'}
            </span>
          </div>
        )}

        <div className="relative group">
          {isLoading && searchQuery.trim() ? (
            <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
          ) : (
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground transition-colors group-focus-within:text-primary" />
          )}
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-white/5 border-white/8 focus-visible:ring-primary/40 rounded-lg placeholder:text-muted-foreground/50"
          />
        </div>

        <Button
          variant="default"
          size="sm"
          className="w-full gap-2 rounded-lg h-8 text-xs font-medium"
          onClick={onNewChat}
        >
          <Plus className="h-3.5 w-3.5" />
          New Chat
        </Button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : conversations.length === 0 && searchQuery.trim() ? (
          <NoSearchResults query={searchQuery} />
        ) : conversations.length === 0 ? (
          <EmptyConversationState onNewChat={onNewChat} />
        ) : (
          <div className="px-2 pb-4 space-y-1">
            {conversations.map((conversation) => {
              const isCurrentChat = conversation.id === currentChatId;
              const isConfirmingDelete = conversation.id === deleteConfirmId;

              return (
                <div
                  key={conversation.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'group relative flex items-start gap-2 rounded-xl px-2.5 py-2 transition-colors text-left w-full cursor-pointer',
                    isCurrentChat
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-white/5 border border-transparent'
                  )}
                  onClick={() => handleSelect(conversation.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelect(conversation.id);
                    }
                  }}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                      isCurrentChat
                        ? 'bg-primary/20 text-primary'
                        : 'bg-white/8 text-muted-foreground'
                    )}
                  >
                    <MessageSquare className="h-3 w-3" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p
                        className={cn(
                          'text-xs font-medium truncate leading-5',
                          isCurrentChat ? 'text-primary' : 'text-foreground'
                        )}
                      >
                        {conversation.title}
                      </p>

                      {/* Actions - visible on hover */}
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
                          isExporting={exportingFormat !== null}
                          isDeleting={deletingId === conversation.id}
                          onExportMarkdown={handleExportMarkdown}
                          onExportJson={handleExportJson}
                          onCopyShareLink={handleCopyShareLink}
                          onDelete={() => setDeleteConfirmId(conversation.id)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-muted-foreground/70">
                        {formatDate(conversation.updatedAt)}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground/70">
                        <FileText className="h-2.5 w-2.5" />
                        {conversation.messageCount}
                      </span>
                      {(isOffline || isLiefi) && isFromCache && !searchQuery.trim() && (
                        <span className="text-[10px] text-amber-500/60 ml-auto">cached</span>
                      )}
                    </div>
                  </div>

                  {/* Delete confirmation overlay */}
                  {isConfirmingDelete && (
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
                        disabled={deletingId === conversation.id}
                        onClick={() => handleDelete(conversation.id)}
                      >
                        {deletingId === conversation.id ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3 mr-1" />
                        )}
                        {deletingId === conversation.id ? 'Deleting...' : 'Delete'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs rounded-full px-3"
                        disabled={deletingId === conversation.id}
                        onClick={() => setDeleteConfirmId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export default ConversationHistoryList;
