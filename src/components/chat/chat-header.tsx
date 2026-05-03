'use client';

import { History, PanelLeft, Plus, Settings } from 'lucide-react';
import { memo, useCallback } from 'react';
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
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ApiKeySettings } from './api-key-settings';
import { useChatContext } from './chat-context';
import { ModelPicker } from './model-picker';
import { ShareDialog } from './share-dialog';

interface ChatHeaderProps {
  selectedModel?: string;
  chatId?: string;
  chatTitle?: string;
  isStreaming: boolean;
  onNewChat?: () => void;
  onModelChange?: (modelId: string) => void;
  onAgentModeToggle?: (enabled: boolean) => void;
}

export const ChatHeader = memo(function ChatHeader({
  selectedModel = 'arcee-ai/trinity-large-preview:free',
  chatId,
  chatTitle,
  isStreaming,
  onNewChat,
  onModelChange,
  onAgentModeToggle,
}: ChatHeaderProps) {
  const { state, dispatch } = useChatContext();

  const handleAgentModeToggle = useCallback(
    (enabled: boolean) => {
      dispatch({ type: 'SET_AGENT_MODE', enabled });
      onAgentModeToggle?.(enabled);
    },
    [dispatch, onAgentModeToggle]
  );

  return (
    <header className="flex h-12 items-center justify-between border-b border-border/20 px-4 bg-white/5 backdrop-blur-sm relative z-30">
      <div className="flex items-center gap-2 lg:hidden">
        <div className="w-12" />
      </div>

      <div className="flex items-center gap-3">
        <TooltipProvider delayDuration={0}>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'rounded-full h-8 w-8 transition-colors',
              state.isHistoryPanelOpen
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
            onClick={() => dispatch({ type: 'SET_HISTORY_PANEL_OPEN', open: true })}
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
        <ModelPicker
          selectedModel={selectedModel}
          onModelChange={onModelChange || (() => {})}
          disabled={isStreaming}
        />
        <AgentModeToggleCompact
          enabled={state.isAgentMode}
          onToggle={handleAgentModeToggle}
          disabled={isStreaming}
        />
        <ApiKeySettings />
        {chatId && <ShareDialog chatId={chatId} chatTitle={chatTitle || 'Chat'} />}
      </div>

      <div className="flex items-center gap-2 bg-foreground/5 p-1 rounded-full border border-white/5 shadow-inner">
        <TooltipProvider delayDuration={0}>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'hidden md:flex rounded-full h-8 w-8 transition-colors',
              !state.isSourcesInlineCollapsed
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
            onClick={() => dispatch({ type: 'TOGGLE_SOURCES_INLINE' })}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </TooltipProvider>

        <div className="w-px h-4 bg-border/40 hidden md:block mx-1" />

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
  );
});
