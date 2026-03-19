/**
 * Live Chat Indicator Component
 * Shows when someone else is viewing the same chat
 * Indicates real-time message sync status
 */

'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { RoomMember, RealtimeMessage } from '@/lib/realtime/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Clock } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface LiveChatIndicatorProps {
  users: RoomMember[];
  currentUserId?: string;
  isConnected: boolean;
  isSyncing?: boolean;
  lastSyncAt?: Date;
  pendingMessages?: number;
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
}

interface SyncStatusIndicatorProps {
  isConnected: boolean;
  isSyncing?: boolean;
  lastSyncAt?: Date;
  className?: string;
}

interface MessageSyncBadgeProps {
  pendingCount: number;
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
  }).format(date);
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return formatTime(date);
}

// =============================================================================
// Sync Status Indicator
// =============================================================================

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  isConnected,
  isSyncing,
  lastSyncAt,
  className,
}) => {
  if (isSyncing) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-blue-500', className)}>
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span>Syncing...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-amber-500', className)}>
        <WifiOff className="h-3 w-3" />
        <span>Offline</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1.5 text-xs text-green-500', className)}>
            <Wifi className="h-3 w-3" />
            <span>Live</span>
            {lastSyncAt && (
              <span className="text-muted-foreground">
                • {getRelativeTime(lastSyncAt)}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Connected to real-time updates</p>
          {lastSyncAt && (
            <p className="text-xs text-muted-foreground">
              Last synced: {formatTime(lastSyncAt)}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// =============================================================================
// Message Sync Badge
// =============================================================================

export const MessageSyncBadge: React.FC<MessageSyncBadgeProps> = ({
  pendingCount,
  className,
}) => {
  if (pendingCount === 0) return null;

  return (
    <Badge 
      variant="secondary" 
      className={cn('gap-1 text-xs animate-pulse', className)}
    >
      <Clock className="h-3 w-3" />
      {pendingCount} pending
    </Badge>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const LiveChatIndicator: React.FC<LiveChatIndicatorProps> = ({
  users,
  currentUserId,
  isConnected,
  isSyncing,
  lastSyncAt,
  pendingMessages = 0,
  className,
  variant = 'default',
}) => {
  const otherUsers = useMemo(() => {
    return users.filter(u => u.user.id !== currentUserId);
  }, [users, currentUserId]);

  const viewerCount = otherUsers.length;

  // Compact variant
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <SyncStatusIndicator 
          isConnected={isConnected} 
          isSyncing={isSyncing}
          lastSyncAt={lastSyncAt}
        />
        {viewerCount > 0 && (
          <span className="text-xs text-muted-foreground">
            • {viewerCount} viewing
          </span>
        )}
      </div>
    );
  }

  // Detailed variant
  if (variant === 'detailed') {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <SyncStatusIndicator 
            isConnected={isConnected} 
            isSyncing={isSyncing}
            lastSyncAt={lastSyncAt}
          />
          <MessageSyncBadge pendingCount={pendingMessages} />
        </div>
        
        {viewerCount > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <div className="flex -space-x-1.5">
              {otherUsers.slice(0, 4).map(user => (
                <Avatar 
                  key={user.user.id} 
                  className="h-5 w-5 border-2 border-background"
                >
                  <AvatarImage src={user.user.image || undefined} />
                  <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                    {getInitials(user.user.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {viewerCount === 1 
                ? `${otherUsers[0].user.name} is viewing` 
                : `${viewerCount} people viewing`
              }
            </span>
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Connection Status */}
      <SyncStatusIndicator 
        isConnected={isConnected} 
        isSyncing={isSyncing}
        lastSyncAt={lastSyncAt}
      />

      {/* Divider */}
      {(viewerCount > 0 || pendingMessages > 0) && (
        <span className="text-muted-foreground">|</span>
      )}

      {/* Viewing Users */}
      {viewerCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {otherUsers.slice(0, 3).map((user, i) => (
                    <Avatar 
                      key={user.user.id} 
                      className="h-5 w-5 border-2 border-background"
                      style={{ zIndex: 3 - i }}
                    >
                      <AvatarImage src={user.user.image || undefined} />
                      <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                        {getInitials(user.user.name)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {viewerCount === 1 
                    ? '1 viewing' 
                    : `${viewerCount} viewing`
                  }
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="space-y-1">
                {otherUsers.map(user => (
                  <div key={user.user.id} className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm">{user.user.name}</span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Pending Messages */}
      {pendingMessages > 0 && (
        <MessageSyncBadge pendingCount={pendingMessages} />
      )}
    </div>
  );
};

// =============================================================================
// Live Message Status Component
// =============================================================================

interface LiveMessageStatusProps {
  message: RealtimeMessage;
  currentUserId?: string;
  isDelivered?: boolean;
  isRead?: boolean;
  readBy?: RoomMember[];
  className?: string;
}

export const LiveMessageStatus: React.FC<LiveMessageStatusProps> = ({
  message,
  currentUserId,
  isDelivered,
  isRead,
  readBy = [],
  className,
}) => {
  const isOwnMessage = message.user.id === currentUserId;
  const otherReaders = readBy.filter(u => u.user.id !== currentUserId);

  if (!isOwnMessage) return null;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {isRead ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center text-blue-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <CheckCircle2 className="h-3.5 w-3.5 -ml-1.5" />
                {otherReaders.length > 0 && (
                  <span className="text-[10px] ml-0.5">{otherReaders.length}</span>
                )}
              </div>
            </TooltipTrigger>
            {otherReaders.length > 0 && (
              <TooltipContent side="bottom">
                <p className="text-xs">Read by:</p>
                {otherReaders.map(reader => (
                  <p key={reader.user.id} className="text-xs text-muted-foreground">
                    {reader.user.name}
                  </p>
                ))}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      ) : isDelivered ? (
        <div className="flex items-center text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <CheckCircle2 className="h-3.5 w-3.5 -ml-1.5" />
        </div>
      ) : (
        <Clock className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
      )}
    </div>
  );
};

// =============================================================================
// Real-time Activity Badge
// =============================================================================

interface RealtimeActivityBadgeProps {
  isActive: boolean;
  activityLabel?: string;
  className?: string;
}

export const RealtimeActivityBadge: React.FC<RealtimeActivityBadgeProps> = ({
  isActive,
  activityLabel = 'Live',
  className,
}) => {
  return (
    <Badge 
      variant={isActive ? 'default' : 'secondary'}
      className={cn(
        'gap-1.5 text-xs font-medium',
        isActive && 'bg-green-500/10 text-green-600 hover:bg-green-500/20',
        className
      )}
    >
      {isActive && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
        </span>
      )}
      {activityLabel}
    </Badge>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default LiveChatIndicator;
