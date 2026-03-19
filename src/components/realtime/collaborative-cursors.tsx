/**
 * Collaborative Cursors Component
 * Displays live cursor positions of other users in the workspace
 * Optional advanced feature for real-time collaboration
 */

'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { UserInfo, CursorPosition } from '@/lib/realtime/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// =============================================================================
// Types
// =============================================================================

interface CursorState {
  user: UserInfo;
  position: CursorPosition;
  timestamp: number;
}

interface CollaborativeCursorsProps {
  cursors: Map<string, CursorState>;
  currentUserId?: string;
  containerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  showLabels?: boolean;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
}

interface CursorProps {
  cursor: CursorState;
  showLabel?: boolean;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
  isActive?: boolean;
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

function generateCursorColor(userId: string): string {
  // Generate a consistent color based on user ID
  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#84cc16', // lime
    '#10b981', // emerald
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#8b5cf6', // violet
    '#d946ef', // fuchsia
    '#f43f5e', // rose
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// =============================================================================
// Individual Cursor Component
// =============================================================================

const Cursor: React.FC<CursorProps> = ({
  cursor,
  showLabel = true,
  labelPosition = 'top',
  isActive = true,
}) => {
  const { user, position } = cursor;
  const color = useMemo(() => generateCursorColor(user.id), [user.id]);
  
  const labelOffsetClasses = {
    top: '-translate-x-1/2 -translate-y-full -mt-1',
    bottom: '-translate-x-1/2 translate-y-full mt-1',
    left: '-translate-x-full -translate-y-1/2 -mr-1',
    right: 'translate-x-0 -translate-y-1/2 ml-1',
  };

  const cursorSvg = (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      style={{
        color,
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
      }}
    >
      <path
        d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
        fill={color}
        stroke="white"
        strokeWidth="1"
      />
    </svg>
  );

  return (
    <div
      className={cn(
        'absolute pointer-events-none transition-all duration-75 ease-out',
        !isActive && 'opacity-50'
      )}
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(2px, 2px)',
      }}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">
              {cursorSvg}
              
              {showLabel && (
                <div
                  className={cn(
                    'absolute left-0 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium text-white shadow-sm',
                    'transition-opacity duration-200',
                    labelOffsetClasses[labelPosition]
                  )}
                  style={{ backgroundColor: color }}
                >
                  <div className="flex items-center gap-1">
                    <Avatar className="h-3.5 w-3.5 border border-white/50">
                      <AvatarImage src={user.image || undefined} />
                      <AvatarFallback className="text-[8px] bg-transparent">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[80px]">{user.name}</span>
                  </div>
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-sm font-medium">{user.name}</p>
            {position.elementId && (
              <p className="text-xs text-muted-foreground">
                Editing: {position.elementId}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {/* Selection highlight */}
      {position.selection && (
        <div
          className="absolute rounded-sm opacity-20"
          style={{
            backgroundColor: color,
            // Position would need to be calculated based on text selection
            left: 0,
            top: 20,
            width: 100,
            height: 20,
          }}
        />
      )}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const CollaborativeCursors: React.FC<CollaborativeCursorsProps> = ({
  cursors,
  currentUserId,
  containerRef,
  className,
  showLabels = true,
  labelPosition = 'top',
}) => {
  // Filter out current user and stale cursors (older than 30 seconds)
  const activeCursors = useMemo(() => {
    const now = Date.now();
    const filtered: CursorState[] = [];
    
    for (const [userId, cursor] of cursors.entries()) {
      if (
        userId !== currentUserId &&
        now - cursor.timestamp < 30000 // 30 second timeout
      ) {
        filtered.push(cursor);
      }
    }
    
    return filtered;
  }, [cursors, currentUserId]);

  if (activeCursors.length === 0) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none overflow-hidden',
        className
      )}
      style={{
        // Ensure cursors are positioned relative to the container
        position: containerRef?.current ? 'absolute' : 'fixed',
      }}
    >
      {activeCursors.map(cursor => (
        <Cursor
          key={cursor.user.id}
          cursor={cursor}
          showLabel={showLabels}
          labelPosition={labelPosition}
          isActive={Date.now() - cursor.timestamp < 5000}
        />
      ))}
    </div>
  );
};

// =============================================================================
// Simplified Cursor List Component
// =============================================================================

interface CursorListProps {
  cursors: Map<string, CursorState>;
  currentUserId?: string;
  className?: string;
}

export const CursorList: React.FC<CursorListProps> = ({
  cursors,
  currentUserId,
  className,
}) => {
  const activeUsers = useMemo(() => {
    const now = Date.now();
    const users: Array<{ user: UserInfo; color: string }> = [];
    
    for (const [userId, cursor] of cursors.entries()) {
      if (
        userId !== currentUserId &&
        now - cursor.timestamp < 30000
      ) {
        users.push({
          user: cursor.user,
          color: generateCursorColor(userId),
        });
      }
    }
    
    return users;
  }, [cursors, currentUserId]);

  if (activeUsers.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-xs text-muted-foreground">Active cursors:</span>
      <div className="flex -space-x-1">
        {activeUsers.map(({ user, color }) => (
          <TooltipProvider key={user.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="h-5 w-5 rounded-full border-2 border-background flex items-center justify-center"
                  style={{ backgroundColor: color }}
                >
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={user.image || undefined} />
                    <AvatarFallback className="text-[8px] bg-transparent text-white">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs font-medium">{user.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// Cursor Activity Indicator
// =============================================================================

interface CursorActivityIndicatorProps {
  cursors: Map<string, CursorState>;
  currentUserId?: string;
  className?: string;
}

export const CursorActivityIndicator: React.FC<CursorActivityIndicatorProps> = ({
  cursors,
  currentUserId,
  className,
}) => {
  const activeCount = useMemo(() => {
    const now = Date.now();
    let count = 0;
    
    for (const [userId, cursor] of cursors.entries()) {
      if (
        userId !== currentUserId &&
        now - cursor.timestamp < 30000
      ) {
        count++;
      }
    }
    
    return count;
  }, [cursors, currentUserId]);

  if (activeCount === 0) return null;

  return (
    <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <span className="relative flex h-2 w-2">
        <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
      </span>
      <span>
        {activeCount === 1 ? '1 active cursor' : `${activeCount} active cursors`}
      </span>
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default CollaborativeCursors;
