'use client';

import { Menu } from 'lucide-react';
import type React from 'react';
import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ChatProvider, useChatContext } from './chat-context';
import { ChatHeader } from './chat-header';
import { ChatInputArea } from './chat-input-area';
import { ChatMessages } from './chat-messages';
import type { Source } from './citations';
import { ConversationHistoryPanel } from './conversation-history-panel';
import { SourcesPanel } from './sources-panel';

const noop = () => {};

interface ChatContainerProps {
  messages: import('./message-item').Message[];
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
  onFeedback?: (messageId: string, rating: 'UP' | 'DOWN') => void;
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
  selectedModel = 'google/gemini-2.0-flash-exp:free',
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
  return (
    <ChatProvider initialAgentMode={agentMode}>
      <ChatInner
        messages={messages}
        sources={sources}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        selectedModel={selectedModel}
        chatId={chatId}
        chatTitle={chatTitle}
        onSendMessage={onSendMessage}
        onCancelStreaming={onCancelStreaming}
        onLoadMore={onLoadMore}
        onEditMessage={onEditMessage}
        onDeleteMessage={onDeleteMessage}
        onNewChat={onNewChat}
        onModelChange={onModelChange}
        onAgentModeToggle={onAgentModeToggle}
        onRegenerate={onRegenerate}
        onFeedback={onFeedback}
        onSelectConversation={onSelectConversation}
        onDeleteConversation={onDeleteConversation}
        onUploadClick={onUploadClick}
        onFilesDrop={onFilesDrop}
        hasMore={hasMore}
        isLoading={isLoading}
        sidebar={sidebar}
        className={className}
      />
    </ChatProvider>
  );
});

// Inner component that has access to ChatContext
interface ChatInnerProps extends Omit<ChatContainerProps, 'hasMore' | 'isLoading'> {
  hasMore: boolean;
  isLoading: boolean;
}

const ChatInner = memo(function ChatInner({
  messages,
  sources,
  isStreaming,
  streamingContent,
  selectedModel,
  chatId,
  chatTitle,
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
  hasMore,
  isLoading,
  sidebar,
  className,
}: ChatInnerProps) {
  const { state, dispatch } = useChatContext();
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

      {/* Desktop sidebar */}
      {sidebar && (
        <div className="hidden lg:flex w-[280px] shrink-0 flex-col h-full relative z-20 glass-heavy rounded-2xl overflow-hidden border border-white/10 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.3)]">
          {sidebar}
        </div>
      )}

      {/* Main chat area */}
      <div
        className="flex-1 min-w-0 h-full grid relative z-10 glass-heavy rounded-2xl overflow-hidden border border-white/10 shadow-[0_12px_48px_-12px_rgba(0,0,0,0.4)]"
        style={{ gridTemplateRows: 'auto 1fr auto' }}
      >
        <ChatHeader
          selectedModel={selectedModel}
          chatId={chatId}
          chatTitle={chatTitle}
          isStreaming={isStreaming}
          onNewChat={onNewChat}
          onModelChange={onModelChange}
          onAgentModeToggle={onAgentModeToggle}
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
      </div>

      {/* Mobile Sources Modal */}
      <SourcesPanel
        sources={sources}
        isOpen={state.isSourcesPanelOpen}
        onClose={() => dispatch({ type: 'SET_SOURCES_PANEL_OPEN', open: false })}
        onSourceClick={(source) => dispatch({ type: 'SET_SELECTED_SOURCE', source })}
      />

      {/* Conversation History Panel */}
      <ConversationHistoryPanel
        currentChatId={chatId}
        onSelectConversation={onSelectConversation || noop}
        onDeleteConversation={onDeleteConversation || noop}
        onNewChat={onNewChat || noop}
        isOpen={state.isHistoryPanelOpen}
        onClose={() => dispatch({ type: 'SET_HISTORY_PANEL_OPEN', open: false })}
      />
    </div>
  );
});
