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
import { apiFetch } from '@/lib/api-client';
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

function getChatGradient(id: string): string {
  const colors = [
    'from-violet-500/12 to-purple-600/4 border-violet-500/20 text-violet-400',
    'from-blue-500/12 to-indigo-600/4 border-blue-500/20 text-blue-400',
    'from-emerald-500/12 to-teal-600/4 border-emerald-500/20 text-emerald-400',
    'from-rose-500/12 to-red-600/4 border-rose-500/20 text-rose-400',
    'from-amber-500/12 to-orange-600/4 border-amber-500/20 text-amber-400',
    'from-cyan-500/12 to-sky-600/4 border-cyan-500/20 text-cyan-400',
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
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
    <div className="flex flex-col items-center justify-center h-full px-6 py-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-600/5 border border-primary/25 flex items-center justify-center mb-4 shadow-[0_4px_20px_rgba(139,92,246,0.15)] animate-pulse-soft">
        <MessageSquare className="h-6.5 w-6.5 text-primary" />
      </div>
      <h3 className="text-xs font-semibold text-foreground mb-1">No conversations yet</h3>
      <p className="text-[11px] text-muted-foreground/80 mb-4 max-w-[200px] leading-relaxed">
        Start a new chat to begin a conversation with the AI assistant.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 rounded-full text-xs h-8 px-4 bg-white/[0.02] border-white/8 hover:bg-white/[0.08] hover:border-white/15 transition-all duration-200 cursor-pointer shadow-sm active:scale-98"
        onClick={onNewChat}
      >
        <Plus className="h-3.5 w-3.5" />
        New Chat
      </Button>
    </div>
  );
}

function NoSearchResults({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-3 text-muted-foreground/60">
        <Search className="h-5 w-5" />
      </div>
      <p className="text-xs text-muted-foreground">
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
        const data = await apiFetch<{ items?: ConversationSummary[] }>(
          `/api/chats?limit=50&search=${encodeURIComponent(searchQuery.trim())}`
        );
        if (!searchCancelledRef.current)
          setSearchConversations(
            Array.isArray(data.items) ? data.items : ([] as ConversationSummary[])
          );
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
        await apiFetch(`/api/chat?chatId=${encodeURIComponent(chatId)}`, {
          method: 'DELETE',
        });

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
    <div className="flex h-full flex-col w-full min-w-0 overflow-hidden">
      {/* Search row */}
      <div className="shrink-0 px-3 pt-2.5 pb-2.5 space-y-2">
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
            className="pl-8 pr-8 h-8 text-xs bg-white/5 border-white/8 focus-visible:ring-primary/30 rounded-lg placeholder:text-muted-foreground/50 transition-all duration-200"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none hidden h-4.5 select-none items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[9px] font-medium text-muted-foreground/50 opacity-100 sm:flex">
            /
          </kbd>
        </div>

        <Button
          variant="default"
          size="sm"
          className="w-full gap-1.5 rounded-lg h-8 text-xs font-semibold bg-gradient-to-r from-primary to-purple-600 hover:from-primary/95 hover:to-purple-600/95 border border-primary/20 text-white shadow-[0_2px_12px_rgba(139,92,246,0.18)] hover:shadow-[0_4px_20px_rgba(139,92,246,0.28)] hover:-translate-y-[0.5px] active:translate-y-0 active:scale-98 transition-all duration-200 cursor-pointer"
          onClick={onNewChat}
        >
          <Plus className="h-3.5 w-3.5" />
          New Chat
        </Button>
      </div>

      {/* Divider */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/8 to-transparent shrink-0" />

      {/* Conversation list */}
      <ScrollArea className="flex-1 scrollbar-thin min-w-0 w-full">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : conversations.length === 0 && searchQuery.trim() ? (
          <NoSearchResults query={searchQuery} />
        ) : conversations.length === 0 ? (
          <EmptyConversationState onNewChat={onNewChat} />
        ) : (
          <div className="px-2 pb-4 space-y-1 w-full min-w-0">
            {conversations.map((conversation) => {
              const isCurrentChat = conversation.id === currentChatId;
              const isConfirmingDelete = conversation.id === deleteConfirmId;

              return (
                <div
                  key={conversation.id}
                  role="button"
                  tabIndex={0}
                  style={{ boxSizing: 'border-box', width: '100%', maxWidth: '100%', minWidth: 0 }}
                  className={cn(
                    'group relative flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left cursor-pointer border transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
                    isCurrentChat
                      ? 'bg-gradient-to-r from-primary/[0.08] via-primary/[0.03] to-transparent border-primary/20 shadow-[0_4px_16px_-4px_rgba(139,92,246,0.15)]'
                      : 'bg-white/[0.01] hover:bg-white/[0.04] border-white/4 hover:border-white/8 hover:shadow-[0_4px_16px_-6px_rgba(0,0,0,0.4)] hover:-translate-y-[0.5px] active:translate-y-0 active:bg-white/[0.02] active:scale-[0.99]'
                  )}
                  onClick={() => handleSelect(conversation.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelect(conversation.id);
                    }
                  }}
                >
                  {/* Selected Indicator Pill - Neon Glow Bar */}
                  {isCurrentChat && (
                    <div
                      className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-md bg-primary shadow-[0_0_12px_rgba(139,92,246,0.8)] animate-pulse-soft"
                      aria-hidden="true"
                    />
                  )}

                  {/* Frosted Dynamic Gradient Icon */}
                  <div
                    className={cn(
                      'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br transition-all duration-300',
                      isCurrentChat
                        ? 'from-primary/25 to-primary/10 border-primary/30 text-primary shadow-[0_0_12px_rgba(139,92,246,0.25)]'
                        : `${getChatGradient(conversation.id)} group-hover:scale-105`
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1 min-w-0 w-full">
                      <p
                        className={cn(
                          'text-xs font-semibold truncate leading-5 flex-1 min-w-0 transition-colors duration-150',
                          isCurrentChat
                            ? 'text-primary'
                            : 'text-foreground/90 group-hover:text-foreground'
                        )}
                      >
                        {conversation.title}
                      </p>

                      {/* Actions - visible and slides/fades in on hover */}
                      <div
                        role="presentation"
                        className="shrink-0 opacity-0 translate-x-1 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 ease-out"
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

                    <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground/60">
                      <span className="font-medium group-hover:text-muted-foreground/80 transition-colors duration-150">
                        {formatDate(conversation.updatedAt)}
                      </span>
                      <span className="text-white/10" aria-hidden="true">
                        •
                      </span>
                      <span className="flex items-center gap-0.5 bg-white/[0.03] border border-white/5 px-1.5 py-0.5 rounded-md font-mono text-[9px] group-hover:border-white/10 transition-colors duration-150">
                        <FileText className="h-2.5 w-2.5 text-muted-foreground/50" />
                        {conversation.messageCount} msg{conversation.messageCount !== 1 ? 's' : ''}
                      </span>
                      {(isOffline || isLiefi) && isFromCache && !searchQuery.trim() && (
                        <span className="text-[9px] font-medium text-amber-500/80 bg-amber-500/10 border border-amber-500/10 px-1.5 py-0.5 rounded-md ml-auto">
                          cached
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete confirmation overlay */}
                  {isConfirmingDelete && (
                    <div
                      role="presentation"
                      className="absolute inset-0 flex items-center justify-center gap-2 bg-background/95 backdrop-blur-sm rounded-lg z-10 border border-destructive/30"
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
