"use client";

import { Menu, Moon, PanelLeft, Plus, Settings, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import type React from 'react';
import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { Source } from './citations';
import { EmptyState } from './empty-state';
import { MessageInput } from './message-input';
import type { Message } from './message-item';
import { MessageList } from './message-list';
import { InlineSourcesPanel, SourcesPanel } from './sources-panel';

interface ChatContainerProps {
  messages: Message[];
  sources: Source[];
  isStreaming: boolean;
  streamingContent: string;
  onSendMessage: (message: string, files?: File[]) => void;
  onCancelStreaming: () => void;
  onLoadMore?: () => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onDeleteMessage?: (id: string) => void;
  onNewChat?: () => void;
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
  onSendMessage,
  onCancelStreaming,
  onLoadMore,
  onEditMessage,
  onDeleteMessage,
  onNewChat,
  hasMore = false,
  isLoading = false,
  sidebar,
  className,
}: ChatContainerProps) {
  const { theme, setTheme } = useTheme();
  const [isSourcesPanelOpen, setIsSourcesPanelOpen] = useState(false);
  const [isSourcesInlineCollapsed, setIsSourcesInlineCollapsed] = useState(true);
  const [, setSelectedSource] = useState<Source | null>(null);

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
    <div className={cn('flex h-screen bg-transparent relative overflow-hidden', className)}>
      {/* Dynamic Background Noise/Gradient optional here since we're in app layout */}
      <div className="absolute inset-0 bg-background/40 backdrop-blur-3xl -z-10" />

      {/* Mobile sidebar */}
      {sidebar && (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="absolute left-4 top-4 z-50 lg:hidden shadow-md glass rounded-full">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] sm:w-[380px] p-0 border-r-0 glass shadow-2xl">
            {sidebar}
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop sidebar */}
      {sidebar && (
        <div className="hidden w-80 lg:block border-r border-white/5 relative z-20">
          {sidebar}
        </div>
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0 relative z-10">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-border/40 px-6 backdrop-blur-md bg-foreground/5 relative z-30 shadow-sm">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8" />
          </div>

          <div className="flex items-center gap-3">
            {onNewChat && (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button variant="default" size="sm" className="gap-2 rounded-full shadow-lg shadow-primary/20 bg-primary/90 hover:bg-primary" onClick={onNewChat}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">New Session</span>
                </Button>
              </motion.div>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-foreground/5 p-1 rounded-full border border-white/5">
            {/* Sources toggle */}
            <TooltipProvider delayDuration={0}>
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex rounded-full h-8 w-8 hover:bg-background/50 text-muted-foreground hover:text-foreground"
                onClick={() => setIsSourcesInlineCollapsed(!isSourcesInlineCollapsed)}
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </TooltipProvider>

            <div className="w-px h-4 bg-border/50 hidden md:block" />

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-8 w-8 hover:bg-background/50 text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Settings */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-background/50 text-muted-foreground hover:text-foreground">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass border-border/50 shadow-2xl rounded-xl min-w-48 mt-2 p-2">
                <DropdownMenuLabel className="font-semibold text-foreground">Preferences</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem className="rounded-lg focus:bg-primary/20 focus:text-primary cursor-pointer transition-colors">
                  Model: GPT-4o-mini
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-lg focus:bg-primary/20 focus:text-primary cursor-pointer transition-colors">
                  Temperature: 0.7
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border/50" />
                <DropdownMenuItem className="rounded-lg focus:bg-primary/20 focus:text-primary cursor-pointer transition-colors">
                  Open Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Chat content bounds */}
        <div className="flex flex-1 overflow-hidden relative">
          <div className="flex flex-1 flex-col min-w-0 bg-transparent">
            {hasMessages ? (
              <>
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
                />
                
                {/* Input area gets a nice fade up floating container */}
                <motion.div 
                  initial={{ y: 20, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  className="px-4 pb-6 pt-4 bg-gradient-to-t from-background via-background/90 to-transparent"
                >
                  <MessageInput
                    onSend={onSendMessage}
                    isLoading={isLoading || isStreaming}
                    disabled={isLoading}
                  />
                </motion.div>
              </>
            ) : (
              <EmptyState
                onSuggestionClick={onSendMessage}
                onUploadClick={() => {
                  /* Trigger upload */
                }}
              />
            )}
          </div>

          {/* Inline sources panel (desktop) */}
          <div className="hidden md:block">
            <InlineSourcesPanel
              sources={sources}
              isCollapsed={isSourcesInlineCollapsed}
              onToggle={() => setIsSourcesInlineCollapsed(!isSourcesInlineCollapsed)}
              onSourceClick={(source) => {
                setSelectedSource(source);
                setIsSourcesPanelOpen(true);
              }}
            />
          </div>
        </div>
      </div>

      {/* Mobile Sources Modal */}
      <SourcesPanel
        sources={sources}
        isOpen={isSourcesPanelOpen}
        onClose={() => setIsSourcesPanelOpen(false)}
        onSourceClick={(source) => setSelectedSource(source)}
      />
    </div>
  );
}
