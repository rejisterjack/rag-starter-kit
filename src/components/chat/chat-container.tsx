'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { History, Menu, PanelLeft, Plus, Settings } from 'lucide-react';
import type React from 'react';
import { memo, useCallback, useState } from 'react';
import { AgentModeToggleCompact } from '@/components/agent/agent-mode-toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ApiKeySettings } from './api-key-settings';
import type { Source } from './citations';
import { ConversationHistoryPanel } from './conversation-history-panel';
import { EmptyState } from './empty-state';
import { MessageInput } from './message-input';
import type { Message } from './message-item';
import { MessageList } from './message-list';
import { ModelPicker } from './model-picker';
import { ShareDialog } from './share-dialog';
import { InlineSourcesPanel, SourcesPanel } from './sources-panel';

// Stable no-op function to prevent unnecessary re-renders
const noop = () => {};

interface ChatContainerProps {
  messages: Message[];
  sources: Source[];
  isStreaming: boolean;
  streamingContent: string;
  selectedModel?: string;
  chatId?: string;
  chatTitle?: string;
  agentMode?: boolean;
  onSendMessage: (message: string, files?: File[]) => void;
  onCancelStreaming: () => void;
  onLoadMore?: () => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onDeleteMessage?: (id: string) => void;
  onNewChat?: () => void;
  onModelChange?: (modelId: string) => void;
  onAgentModeToggle?: (enabled: boolean) => void;
  onRegenerate?: () => void;
  onFeedback?: (messageId: string, rating: 'up' | 'down') => void;
  onSelectConversation?: (chatId: string) => void;
  onDeleteConversation?: (chatId: string) => void;
  onUploadClick?: () => void;
  onFilesDrop?: (files: File[]) => void;
  hasMore?: boolean;
  isLoading?: boolean;
  sidebar?: React.ReactNode;
  className?: string;
}

export const ChatContainer = memo(function ChatContainer({
  messages,
  sources,
  isStreaming,
  streamingContent,
  selectedModel = 'arcee-ai/trinity-large-preview:free',
  chatId,
  chatTitle,
  agentMode = false,
  onSendMessage,
  onCancelStreaming,
  onLoadMore,
  onEditMessage,
  onDeleteMessage,
  onNewChat,
  onModelChange,
  onAgentModeToggle,
  onRegenerate,
  onFeedback,
  onSelectConversation,
  onDeleteConversation,
  onUploadClick,
  onFilesDrop,
  hasMore = false,
  isLoading = false,
  sidebar,
  className,
}: ChatContainerProps) {
  const [isSourcesPanelOpen, setIsSourcesPanelOpen] = useState(false);
  const [isSourcesInlineCollapsed, setIsSourcesInlineCollapsed] = useState(true);
  const [, setSelectedSource] = useState<Source | null>(null);
  const [isAgentMode, setIsAgentMode] = useState(agentMode);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);

  const handleAgentModeToggle = useCallback(
    (enabled: boolean) => {
      setIsAgentMode(enabled);
      onAgentModeToggle?.(enabled);
    },
    [onAgentModeToggle]
  );

  const handleCitationClick = useCallback(
    (index: number) => {
      const source = sources.find((s) => s.index === index);
      if (source) {
        setSelectedSource(source);
        setIsSourcesPanelOpen(true);
      }
    },
    [sources]
  );

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div
      className={cn(
        'flex h-full w-full p-2 gap-2 overflow-hidden relative text-foreground selection:bg-primary/30',
        className
      )}
    >
      {/* Mobile sidebar trigger */}
      {sidebar && (
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-6 top-6 z-50 lg:hidden shadow-xl glass-heavy rounded-full h-12 w-12 border border-white/20"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[85vw] sm:w-[380px] p-0 border-none glass-heavy shadow-2xl rounded-r-3xl overflow-hidden"
          >
            {sidebar}
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop sidebar as a floating glass panel */}
      {sidebar && (
        <div
          className="hidden lg:flex w-[280px] shrink-0 flex-col h-full relative z-20 glass-heavy rounded-2xl overflow-hidden border border-white/10 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.3)]"
        >
          {sidebar}
        </div>
      )}

      {/* Main chat area — uses grid for strict row sizing */}
      <div
        className="flex-1 min-w-0 h-full grid relative z-10 glass-heavy rounded-2xl overflow-hidden border border-white/10 shadow-[0_12px_48px_-12px_rgba(0,0,0,0.4)]"
        style={{ gridTemplateRows: 'auto 1fr auto' }}
      >
        {/* Header — row 1 */}
        <header className="flex h-12 items-center justify-between border-b border-border/20 px-4 bg-white/5 backdrop-blur-sm relative z-30">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-12" /> {/* Spacer for mobile menu button */}
          </div>

          <div className="flex items-center gap-3">
            {/* History button */}
            <TooltipProvider delayDuration={0}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'rounded-full h-8 w-8 transition-colors',
                  isHistoryPanelOpen
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                )}
                onClick={() => setIsHistoryPanelOpen(true)}
              >
                <History className="h-4 w-4" />
              </Button>
            </TooltipProvider>

            {onNewChat && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 rounded-full shadow-lg shadow-primary/30 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 h-8 text-xs"
                onClick={onNewChat}
              >
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Chat</span>
              </Button>
            )}
            {/* Model Picker */}
            <ModelPicker
              selectedModel={selectedModel}
              onModelChange={onModelChange || (() => {})}
              disabled={isStreaming}
            />

            {/* Agent Mode Toggle */}
            <AgentModeToggleCompact
              enabled={isAgentMode}
              onToggle={handleAgentModeToggle}
              disabled={isStreaming}
            />

            {/* API Key Settings */}
            <ApiKeySettings />

            {/* Share Button */}
            {chatId && <ShareDialog chatId={chatId} chatTitle={chatTitle || 'Chat'} />}
          </div>

          <div className="flex items-center gap-2 bg-foreground/5 p-1 rounded-full border border-white/5 shadow-inner">
            {/* Sources toggle */}
            <TooltipProvider delayDuration={0}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'hidden md:flex rounded-full h-8 w-8 transition-colors',
                  !isSourcesInlineCollapsed
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                )}
                onClick={() => setIsSourcesInlineCollapsed(!isSourcesInlineCollapsed)}
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </TooltipProvider>

            <div className="w-px h-4 bg-border/40 hidden md:block mx-1" />

            {/* Settings */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-8 w-8 hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="glass-panel border-border/30 shadow-2xl rounded-2xl min-w-56 mt-3 p-2"
              >
                <DropdownMenuLabel className="font-bold text-foreground px-3 py-2">
                  Preferences
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/20" />
                <DropdownMenuItem className="rounded-xl px-3 py-2.5 focus:bg-primary/20 focus:text-primary cursor-default transition-colors font-medium">
                  <span className="text-muted-foreground mr-1">Model:</span>{' '}
                  {selectedModel.split('/').pop()?.replace(':free', '') || selectedModel}
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl px-3 py-2.5 focus:bg-primary/20 focus:text-primary cursor-default transition-colors font-medium">
                  <span className="text-muted-foreground mr-1">Temperature:</span> 0.7
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl px-3 py-2.5 focus:bg-primary/20 focus:text-primary cursor-default transition-colors font-medium">
                  <span className="text-muted-foreground mr-1">Streaming:</span> Enabled
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Messages area — row 2 (takes all remaining space, scrolls internally) */}
        <div className="overflow-hidden relative flex h-full min-h-0">
          {/* Messages column */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {hasMessages ? (
              <MessageList
                messages={messages}
                isStreaming={isStreaming}
                streamingContent={streamingContent}
                hasMore={hasMore}
                onLoadMore={onLoadMore}
                onEditMessage={onEditMessage}
                onDeleteMessage={onDeleteMessage}
                onCitationClick={handleCitationClick}
                onCancelStreaming={onCancelStreaming}
                onRegenerate={onRegenerate}
                onFeedback={onFeedback}
                isAgentMode={isAgentMode}
                agentThinking={isAgentMode && isStreaming}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-4">
                <EmptyState
                  onSuggestionClick={onSendMessage}
                  onUploadClick={onUploadClick}
                  onFilesDrop={onFilesDrop}
                />
              </div>
            )}
          </div>

          {/* Inline sources panel (desktop) */}
          <AnimatePresence>
            {!isSourcesInlineCollapsed && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 340, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="hidden md:block border-l border-white/10 bg-white/5 backdrop-blur-sm z-20 overflow-y-auto"
              >
                <InlineSourcesPanel
                  sources={sources}
                  isCollapsed={isSourcesInlineCollapsed}
                  onToggle={() => setIsSourcesInlineCollapsed(!isSourcesInlineCollapsed)}
                  onSourceClick={(source) => {
                    setSelectedSource(source);
                    setIsSourcesPanelOpen(true);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input area — row 3 (auto height, always visible) */}
        <div className="flex justify-center px-3 py-2 border-t border-white/10">
          <MessageInput
            onSend={onSendMessage}
            isLoading={isLoading || isStreaming}
            disabled={isLoading}
            placeholder={hasMessages ? 'Send a message...' : 'Ask anything... or try a suggestion above'}
            className="w-full max-w-4xl"
          />
        </div>
      </div>

      {/* Mobile Sources Modal */}
      <SourcesPanel
        sources={sources}
        isOpen={isSourcesPanelOpen}
        onClose={() => setIsSourcesPanelOpen(false)}
        onSourceClick={(source) => setSelectedSource(source)}
      />

      {/* Conversation History Panel */}
      <ConversationHistoryPanel
        currentChatId={chatId}
        onSelectConversation={onSelectConversation || noop}
        onDeleteConversation={onDeleteConversation || noop}
        onNewChat={onNewChat || noop}
        isOpen={isHistoryPanelOpen}
        onClose={() => setIsHistoryPanelOpen(false)}
      />
    </div>
  );
});
