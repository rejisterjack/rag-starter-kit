/**
 * Presence Indicator Component
 * Shows online/offline status and avatar group of users in a conversation
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { RoomMember, UserInfo } from '@/lib/realtime/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

// =============================================================================
// Types
// =============================================================================

interface PresenceIndicatorProps {
  users: RoomMember[];
  currentUserId?: string;
  maxDisplay?: number;
  showTooltip?: boolean;
  showStatusIndicator?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface UserPresenceBadgeProps {
  user: UserInfo;
  isOnline?: boolean;
  showStatus?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface PresenceStatusIndicatorProps {
  status: 'online' | 'away' | 'offline';
  size?: 'sm' | 'md' | 'lg';
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

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return 'Offline';
}

// =============================================================================
// Status Indicator Component
// =============================================================================

export const PresenceStatusIndicator: React.FC<PresenceStatusIndicatorProps> = ({
  status,
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    offline: 'bg-gray-400',
  };

  return (
    <span
      className={cn(
        'absolute bottom-0 right-0 rounded-full border-2 border-background',
        sizeClasses[size],
        statusColors[status],
        className
      )}
    />
  );
};

// =============================================================================
// User Presence Badge Component
// =============================================================================

export const UserPresenceBadge: React.FC<UserPresenceBadgeProps> = ({
  user,
  isOnline = true,
  showStatus = true,
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm',
  };

  return (
    <div className={cn('relative inline-block', className)}>
      <Avatar className={cn(sizeClasses[size])}>
        <AvatarImage src={user.image || undefined} alt={user.name} />
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      {showStatus && (
        <PresenceStatusIndicator 
          status={isOnline ? 'online' : 'offline'} 
          size={size} 
        />
      )}
    </div>
  );
};

// =============================================================================
// Avatar Stack Component
// =============================================================================

interface AvatarStackProps {
  users: RoomMember[];
  currentUserId?: string;
  maxDisplay?: number;
  showStatus?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const AvatarStack: React.FC<AvatarStackProps> = ({
  users,
  currentUserId,
  maxDisplay = 4,
  showStatus = true,
  size = 'md',
}) => {
  // Filter out current user and sort by recent activity
  const otherUsers = React.useMemo(() => {
    return users
      .filter(u => u.user.id !== currentUserId)
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }, [users, currentUserId]);

  const displayUsers = otherUsers.slice(0, maxDisplay);
  const remainingCount = otherUsers.length - maxDisplay;

  const sizeClasses = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm',
  };

  return (
    <div className="flex -space-x-2">
      {displayUsers.map((member, index) => (
        <div 
          key={member.user.id} 
          className="relative"
          style={{ zIndex: displayUsers.length - index }}
        >
          <Avatar className={cn('border-2 border-background', sizeClasses[size])}>
            <AvatarImage src={member.user.image || undefined} alt={member.user.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {getInitials(member.user.name)}
            </AvatarFallback>
          </Avatar>
          {showStatus && (
            <PresenceStatusIndicator 
              status="online" 
              size={size === 'sm' ? 'sm' : 'md'} 
            />
          )}
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className={cn(
            'flex items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground font-medium',
            sizeClasses[size]
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  users,
  currentUserId,
  maxDisplay = 4,
  showTooltip = true,
  showStatusIndicator = true,
  size = 'md',
  className,
}) => {
  const onlineCount = users.length;
  const otherUsers = users.filter(u => u.user.id !== currentUserId);

  const content = (
    <div className={cn('flex items-center gap-2', className)}>
      <AvatarStack
        users={users}
        currentUserId={currentUserId}
        maxDisplay={maxDisplay}
        showStatus={showStatusIndicator}
        size={size}
      />
      
      {onlineCount > 0 && (
        <Badge variant="secondary" className="text-xs font-normal">
          {onlineCount === 1 
            ? '1 online' 
            : `${onlineCount} online`
          }
        </Badge>
      )}
    </div>
  );

  if (!showTooltip || otherUsers.length === 0) {
    return content;
  }

  const tooltipContent = (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">
        Currently viewing:
      </p>
      {otherUsers.map(member => (
        <div key={member.user.id} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-sm">{member.user.name}</span>
        </div>
      ))}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// =============================================================================
// Compact Variant
// =============================================================================

interface CompactPresenceIndicatorProps {
  users: RoomMember[];
  currentUserId?: string;
  className?: string;
}

export const CompactPresenceIndicator: React.FC<CompactPresenceIndicatorProps> = ({
  users,
  currentUserId,
  className,
}) => {
  const otherUsers = users.filter(u => u.user.id !== currentUserId);
  
  if (otherUsers.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <span>
        {otherUsers.length === 1 
          ? `${otherUsers[0].user.name} is viewing` 
          : `${otherUsers.length} people viewing`
        }
      </span>
    </div>
  );
};

// =============================================================================
// List Variant
// =============================================================================

interface PresenceListProps {
  users: RoomMember[];
  currentUserId?: string;
  showLastActive?: boolean;
  className?: string;
}

export const PresenceList: React.FC<PresenceListProps> = ({
  users,
  currentUserId,
  showLastActive = true,
  className,
}) => {
  const sortedUsers = React.useMemo(() => {
    return [...users].sort((a, b) => {
      // Current user first
      if (a.user.id === currentUserId) return -1;
      if (b.user.id === currentUserId) return 1;
      // Then by last activity
      return b.lastActivity.getTime() - a.lastActivity.getTime();
    });
  }, [users, currentUserId]);

  return (
    <div className={cn('space-y-1', className)}>
      {sortedUsers.map(member => (
        <div 
          key={member.user.id}
          className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50"
        >
          <div className="relative">
            <Avatar className="h-6 w-6">
              <AvatarImage src={member.user.image || undefined} alt={member.user.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {getInitials(member.user.name)}
              </AvatarFallback>
            </Avatar>
            <PresenceStatusIndicator status="online" size="sm" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {member.user.name}
              {member.user.id === currentUserId && (
                <span className="text-muted-foreground font-normal ml-1">(you)</span>
              )}
            </p>
          </div>
          
          {showLastActive && (
            <span className="text-xs text-muted-foreground">
              {getRelativeTime(member.lastActivity)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default PresenceIndicator;
