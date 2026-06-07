'use client';

import { FolderOpen, History } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { DocumentListProps } from '../documents/document-list';
import { DocumentList } from '../documents/document-list';
import type { ConversationHistoryListProps } from './conversation-history-list';
import { ConversationHistoryList } from './conversation-history-list';

interface ChatSidebarProps {
  documentListProps: DocumentListProps;
  historyListProps: ConversationHistoryListProps;
  className?: string;
}

export function ChatSidebar({ documentListProps, historyListProps, className }: ChatSidebarProps) {
  const [activeTab, setActiveTab] = useState<'knowledge' | 'history'>('history');

  return (
    <section
      className={cn('flex h-full flex-col overflow-hidden', className)}
      aria-label="Chat sidebar"
    >
      {/* Tab toggle */}
      <div className="shrink-0 px-3 pt-3 pb-2.5">
        <div className="relative flex items-center rounded-lg bg-white/[0.02] p-1 border border-white/4 gap-0 shadow-inner">
          {/* Sliding active pill */}
          <div
            className="absolute inset-y-1 rounded-md bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/25 shadow-[0_0_12px_rgba(139,92,246,0.12)] transition-all duration-200 ease-out"
            style={{
              width: 'calc(50% - 4px)',
              left: activeTab === 'history' ? '4px' : 'calc(50%)',
            }}
            aria-hidden="true"
          />

          {/* Chat History tab */}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            aria-selected={activeTab === 'history'}
            role="tab"
            className={cn(
              'relative z-10 flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 text-[11px] font-semibold rounded-md transition-all duration-150 min-w-0 cursor-pointer active:scale-98',
              activeTab === 'history'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground/90'
            )}
          >
            <History className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Chat History</span>
          </button>

          {/* Knowledge Base tab */}
          <button
            type="button"
            onClick={() => setActiveTab('knowledge')}
            aria-selected={activeTab === 'knowledge'}
            role="tab"
            className={cn(
              'relative z-10 flex-1 flex items-center justify-center gap-1.5 py-1.5 px-1 text-[11px] font-semibold rounded-md transition-all duration-150 min-w-0 cursor-pointer active:scale-98',
              activeTab === 'knowledge'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground/90'
            )}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Knowledge Base</span>
          </button>
        </div>
      </div>

      {/* Modern Horizontal Divider Gradient */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/8 to-transparent shrink-0" />

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          key={activeTab}
          className="h-full w-full min-w-0 animate-in fade-in slide-in-from-bottom-1 duration-150"
        >
          {activeTab === 'knowledge' ? (
            <DocumentList {...documentListProps} />
          ) : (
            <ConversationHistoryList {...historyListProps} />
          )}
        </div>
      </div>
    </section>
  );
}

export default ChatSidebar;
