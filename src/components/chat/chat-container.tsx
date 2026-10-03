'use client';

import type React from 'react';
import { memo } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ChatProvider, useChatContext } from './chat-context';
import { ChatHeader } from './chat-header';
import { ChatInputArea } from './chat-input-area';
import { ChatMessages } from './chat-messages';
import type { Source } from './citations';
import { DegradationBanner } from './degradation-banner';
import { SourcesPanel } from './sources-panel';

interface ChatContainerProps {
  messages: import('./message-item').Message[];
  sources: Source[];
  isStreaming: boolean;
  streamingContent: string;
  chatId?: string;
  chatTitle?: string;
  agentMode?: boolean;
  onSendMessage: (message: string, files?: File[]) => void;
  onCancelStreaming: () => void;
  onLoadMore?: () => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onDeleteMessage?: (id: string) => void;
  onNewChat?: () => void;
  onAgentModeToggle?: (enabled: boolean) => void;
  onRegenerate?: () => void;
  onFeedback?: (messageId: string, rating: 'UP' | 'DOWN') => void;
  onUploadClick?: () => void;
  onFilesDrop?: (files: File[]) => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isNewChatLoading?: boolean;
  sidebar?: React.ReactNode;
  className?: string;
}

export const ChatContainer = memo(function ChatContainer({
  messages,
  sources,
  isStreaming,
  streamingContent,
  chatId,
  chatTitle,
  agentMode = false,
  onSendMessage,
  onCancelStreaming,
  onLoadMore,
  onEditMessage,
  onDeleteMessage,
  onNewChat,
  onAgentModeToggle,
  onRegenerate,
  onFeedback,
  onUploadClick,
  onFilesDrop,
  hasMore = false,
  isLoading = false,
  isNewChatLoading = false,
  sidebar,
  className,
}: ChatContainerProps) {
  return (
    <ChatProvider initialAgentMode={agentMode}>
      <ChatInner
        messages={messages}
        sources={sources}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        chatId={chatId}
        chatTitle={chatTitle}
        onSendMessage={onSendMessage}
        onCancelStreaming={onCancelStreaming}
        onLoadMore={onLoadMore}
        onEditMessage={onEditMessage}
        onDeleteMessage={onDeleteMessage}
        onNewChat={onNewChat}
        onAgentModeToggle={onAgentModeToggle}
        onRegenerate={onRegenerate}
        onFeedback={onFeedback}
        onUploadClick={onUploadClick}
        onFilesDrop={onFilesDrop}
        hasMore={hasMore}
        isLoading={isLoading}
        isNewChatLoading={isNewChatLoading}
        sidebar={sidebar}
        className={className}
      />
    </ChatProvider>
  );
});

interface ChatInnerProps extends Omit<
  ChatContainerProps,
  'hasMore' | 'isLoading' | 'isNewChatLoading'
> {
  hasMore: boolean;
  isLoading: boolean;
  isNewChatLoading: boolean;
}

const ChatInner = memo(function ChatInner({
  messages,
  sources,
  isStreaming,
  streamingContent,
  chatId,
  chatTitle,
  onSendMessage,
  onCancelStreaming,
  onLoadMore,
  onEditMessage,
  onDeleteMessage,
  onNewChat,
  onAgentModeToggle,
  onRegenerate,
  onFeedback,
  onUploadClick,
  onFilesDrop,
  hasMore,
  isLoading,
  isNewChatLoading,
  sidebar,
  className,
}: ChatInnerProps) {
  const { state, dispatch } = useChatContext();
  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <div
      className={cn(
        'flex h-full w-full overflow-hidden relative text-foreground selection:bg-primary/30',
        'p-0 md:p-2 md:gap-2',
        className
      )}
    >
      {sidebar && (
        <Sheet
          open={state.isMobileSidebarOpen}
          onOpenChange={(open) => dispatch({ type: 'SET_MOBILE_SIDEBAR_OPEN', open })}
        >
          <SheetContent
            side="left"
            className="w-[85vw] sm:w-[380px] p-0 border-none glass-heavy shadow-2xl rounded-r-3xl overflow-hidden md:hidden"
          >
            <SheetTitle className="sr-only">Navigation Sidebar</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>
      )}

      {sidebar && (
        <div className="hidden md:flex w-[280px] shrink-0 flex-col h-full relative z-20 glass-heavy rounded-2xl overflow-hidden border border-white/10 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.3)]">
          {sidebar}
        </div>
      )}

      <section
        aria-label="Chat"
        className={cn(
          'flex-1 min-w-0 h-full relative z-10',
          'flex flex-col',
          'md:glass-heavy md:rounded-2xl md:overflow-hidden md:border md:border-white/10 md:shadow-[0_12px_48px_-12px_rgba(0,0,0,0.4)]'
        )}
      >
        <DegradationBanner />
        <ChatHeader
          chatId={chatId}
          chatTitle={chatTitle}
          isStreaming={isStreaming}
          isNewChatLoading={isNewChatLoading}
          onNewChat={onNewChat}
          onAgentModeToggle={onAgentModeToggle}
          onToggleMobileSidebar={() => dispatch({ type: 'SET_MOBILE_SIDEBAR_OPEN', open: true })}
        />

        <ChatMessages
          messages={messages}
          sources={sources}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          hasMore={hasMore}
          isLoading={isLoading}
          onLoadMore={onLoadMore}
          onEditMessage={onEditMessage}
          onDeleteMessage={onDeleteMessage}
          onCancelStreaming={onCancelStreaming}
          onRegenerate={onRegenerate}
          onFeedback={onFeedback}
          onSendMessage={onSendMessage}
          onUploadClick={onUploadClick}
          onFilesDrop={onFilesDrop}
        />

        <ChatInputArea
          hasMessages={hasMessages}
          isLoading={isLoading}
          isStreaming={isStreaming}
          onSendMessage={onSendMessage}
        />
      </section>

      <SourcesPanel
        sources={sources}
        isOpen={state.isSourcesPanelOpen}
        onClose={() => dispatch({ type: 'SET_SOURCES_PANEL_OPEN', open: false })}
        onSourceClick={(source) => dispatch({ type: 'SET_SELECTED_SOURCE', source })}
      />
    </div>
  );
});
