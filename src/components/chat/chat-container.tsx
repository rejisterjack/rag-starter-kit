'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { History, Menu, Moon, PanelLeft, Plus, Settings, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import type React from 'react';
import { useCallback, useState } from 'react';
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
import type { Source } from './citations';
import { ConversationHistoryPanel } from './conversation-history-panel';
import { EmptyState } from './empty-state';
import { MessageInput } from './message-input';
import type { Message } from './message-item';
import { MessageList } from './message-list';
import { ModelPicker } from './model-picker';
import { ShareDialog } from './share-dialog';
import { InlineSourcesPanel, SourcesPanel } from './sources-panel';

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
  hasMore?: boolean;
  isLoading?: boolean;
  sidebar?: React.ReactNode;
  className?: string;
}

export function ChatContainer({
  messages,
  sources,
  isStreaming,
  streamingContent,
  selectedModel = 'deepseek/deepseek-chat:free',
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
  hasMore = false,
  isLoading = false,
  sidebar,
  className,
}: ChatContainerProps) {
  const { theme, setTheme } = useTheme();
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
        'flex h-screen w-full p-4 gap-4 overflow-hidden relative text-foreground selection:bg-primary/30',
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
        <motion.div
          initial={{ opacity: 0, x: -20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring', bounce: 0.3 }}
          className="hidden lg:flex w-[320px] flex-col relative z-20 glass-heavy rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.3)]"
        >
          {sidebar}
        </motion.div>
      )}

      {/* Main chat area as the central floating panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, type: 'spring', bounce: 0.3, delay: 0.1 }}
        className="flex flex-1 flex-col min-w-0 relative z-10 glass-heavy rounded-[2rem] overflow-hidden border border-white/10 shadow-[0_12px_48px_-12px_rgba(0,0,0,0.4)]"
      >
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/20 px-6 bg-white/5 backdrop-blur-xl relative z-30">
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
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2 rounded-full shadow-lg shadow-primary/30 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-5"
                  onClick={onNewChat}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Chat</span>
                </Button>
              </motion.div>
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

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8 hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={theme}
                  initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </motion.div>
              </AnimatePresence>
            </Button>

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
                <DropdownMenuItem className="rounded-xl px-3 py-2.5 focus:bg-primary/20 focus:text-primary cursor-pointer transition-colors font-medium">
                  Model: GPT-4o
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-xl px-3 py-2.5 focus:bg-primary/20 focus:text-primary cursor-pointer transition-colors font-medium">
                  Temperature: 0.7
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/20" />
                <DropdownMenuItem className="rounded-xl px-3 py-2.5 focus:bg-primary/20 focus:text-primary cursor-pointer transition-colors font-medium">
                  Advanced Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Chat content bounds */}
        <div className="flex flex-1 overflow-hidden relative">
          <div className="flex flex-1 flex-col min-w-0 bg-transparent h-full relative">
            {/* The main scrollable area for messages or empty state */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <AnimatePresence mode="wait">
                {hasMessages ? (
                  <motion.div
                    key="messages"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex-1 pb-32"
                  >
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
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="h-full flex items-center justify-center p-8"
                  >
                    <EmptyState
                      onSuggestionClick={onSendMessage}
                      onUploadClick={() => {
                        /* Trigger upload */
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Floating Input Area anchored to the bottom */}
            {hasMessages && (
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-40"
              >
                <div className="glass-panel rounded-3xl p-2 shadow-2xl border border-white/20">
                  <MessageInput
                    onSend={onSendMessage}
                    isLoading={isLoading || isStreaming}
                    disabled={isLoading}
                  />
                </div>
              </motion.div>
            )}
          </div>

          {/* Inline sources panel (desktop) */}
          <AnimatePresence>
            {!isSourcesInlineCollapsed && (
              <motion.div
                initial={{ width: 0, opacity: 0, x: 50 }}
                animate={{ width: 380, opacity: 1, x: 0 }}
                exit={{ width: 0, opacity: 0, x: 50 }}
                transition={{ duration: 0.4, type: 'spring', bounce: 0.2 }}
                className="hidden md:block border-l border-white/10 bg-white/5 backdrop-blur-sm z-20"
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
      </motion.div>

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
        onSelectConversation={onSelectConversation || (() => {})}
        onDeleteConversation={onDeleteConversation || (() => {})}
        onNewChat={onNewChat || (() => {})}
        isOpen={isHistoryPanelOpen}
        onClose={() => setIsHistoryPanelOpen(false)}
      />
    </div>
  );
}
