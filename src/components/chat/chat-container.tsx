'use client';

import { Menu, Moon, PanelLeft, Plus, Settings, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import type React from 'react';
import { useCallback, useState } from 'react';
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
    <div className={cn('flex h-screen bg-background', className)}>
      {/* Mobile sidebar */}
      {sidebar && (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="absolute left-4 top-4 z-50 lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            {sidebar}
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop sidebar */}
      {sidebar && <div className="hidden w-80 border-r lg:block">{sidebar}</div>}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2 lg:hidden">
            {/* Spacer for mobile menu button */}
            <div className="w-8" />
          </div>

          <div className="flex items-center gap-2">
            {onNewChat && (
              <Button variant="ghost" size="sm" className="gap-2" onClick={onNewChat}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New chat</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Sources toggle (desktop) */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex"
              onClick={() => setIsSourcesInlineCollapsed(!isSourcesInlineCollapsed)}
            >
              <PanelLeft className="h-5 w-5" />
            </Button>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* Settings */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Settings</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Model: GPT-4o-mini</DropdownMenuItem>
                <DropdownMenuItem>Temperature: 0.7</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>View all settings</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Chat content */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col min-w-0">
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
                <MessageInput
                  onSend={onSendMessage}
                  isLoading={isLoading || isStreaming}
                  disabled={isLoading}
                />
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

      {/* Sources panel (mobile/sheet) */}
      <SourcesPanel
        sources={sources}
        isOpen={isSourcesPanelOpen}
        onClose={() => setIsSourcesPanelOpen(false)}
        onSourceClick={(source) => setSelectedSource(source)}
      />
    </div>
  );
}
