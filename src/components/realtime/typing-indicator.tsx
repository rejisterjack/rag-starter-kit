/**
 * Typing Indicator Component
 * Shows when users are typing with animated dots
 * Supports multiple users typing simultaneously
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { TypingEvent, UserInfo } from '@/lib/realtime/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// =============================================================================
// Types
// =============================================================================

interface TypingIndicatorProps {
  typingUsers: TypingEvent[];
  currentUserId?: string;
  showAvatar?: boolean;
  className?: string;
  style?: 'dots' | 'text' | 'both';
  align?: 'left' | 'right';
}

// =============================================================================
// Helper Functions
// =============================================================================

function getTypingText(users: UserInfo[], currentUserId?: string): string {
  // Filter out current user
  const otherUsers = users.filter(u => u.id !== currentUserId);
  
  if (otherUsers.length === 0) return '';
  if (otherUsers.length === 1) {
    return `${otherUsers[0].name} is typing`;
  }
  if (otherUsers.length === 2) {
    return `${otherUsers[0].name} and ${otherUsers[1].name} are typing`;
  }
  if (otherUsers.length === 3) {
    return `${otherUsers[0].name}, ${otherUsers[1].name}, and ${otherUsers[2].name} are typing`;
  }
  return `${otherUsers.length} people are typing`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// =============================================================================
// Animated Dots Component
// =============================================================================

const AnimatedDots: React.FC = () => (
  <span className="inline-flex items-center gap-0.5">
    <span 
      className="h-1 w-1 animate-bounce rounded-full bg-current"
      style={{ animationDelay: '0ms' }}
    />
    <span 
      className="h-1 w-1 animate-bounce rounded-full bg-current"
      style={{ animationDelay: '150ms' }}
    />
    <span 
      className="h-1 w-1 animate-bounce rounded-full bg-current"
      style={{ animationDelay: '300ms' }}
    />
  </span>
);

// =============================================================================
// Avatar Stack Component
// =============================================================================

interface AvatarStackProps {
  users: UserInfo[];
  maxDisplay?: number;
  size?: 'sm' | 'md' | 'lg';
}

const AvatarStack: React.FC<AvatarStackProps> = ({ 
  users, 
  maxDisplay = 3,
  size = 'sm',
}) => {
  const displayUsers = users.slice(0, maxDisplay);
  const remainingCount = users.length - maxDisplay;
  
  const sizeClasses = {
    sm: 'h-5 w-5 text-[10px]',
    md: 'h-6 w-6 text-xs',
    lg: 'h-8 w-8 text-sm',
  };

  return (
    <div className="flex -space-x-1.5">
      {displayUsers.map((user, index) => (
        <Avatar 
          key={user.id} 
          className={cn(
            'border-2 border-background ring-0',
            sizeClasses[size]
          )}
          style={{ zIndex: displayUsers.length - index }}
        >
          <AvatarImage src={user.image || undefined} alt={user.name} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
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

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  typingUsers,
  currentUserId,
  showAvatar = true,
  className,
  style = 'both',
  align = 'left',
}) => {
  // Filter to only active typing events (within last 6 seconds)
  const activeUsers = React.useMemo(() => {
    const now = Date.now();
    return typingUsers
      .filter(event => event.isTyping && now - event.timestamp < 6000)
      .map(event => event.user);
  }, [typingUsers]);

  // Don't render if no one is typing (excluding current user)
  const relevantUsers = activeUsers.filter(u => u.id !== currentUserId);
  if (relevantUsers.length === 0) return null;

  const typingText = getTypingText(relevantUsers, currentUserId);
  const showDots = style === 'dots' || style === 'both';
  const showText = style === 'text' || style === 'both';

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm text-muted-foreground',
        align === 'right' && 'flex-row-reverse justify-end',
        className
      )}
    >
      {showAvatar && <AvatarStack users={relevantUsers} />}
      
      <div 
        className={cn(
          'flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5',
          align === 'right' && 'flex-row-reverse'
        )}
      >
        {showText && <span className="text-xs">{typingText}</span>}
        {showDots && <AnimatedDots />}
      </div>
    </div>
  );
};

// =============================================================================
// Compact Variant
// =============================================================================

interface CompactTypingIndicatorProps {
  typingUsers: TypingEvent[];
  currentUserId?: string;
  className?: string;
}

export const CompactTypingIndicator: React.FC<CompactTypingIndicatorProps> = ({
  typingUsers,
  currentUserId,
  className,
}) => {
  const activeCount = React.useMemo(() => {
    const now = Date.now();
    return typingUsers.filter(
      event => event.isTyping && 
               event.user.id !== currentUserId && 
               now - event.timestamp < 6000
    ).length;
  }, [typingUsers, currentUserId]);

  if (activeCount === 0) return null;

  return (
    <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <AnimatedDots />
      <span>
        {activeCount === 1 ? 'Someone is typing' : `${activeCount} people are typing`}
      </span>
    </div>
  );
};

// =============================================================================
// Bubble Variant (for chat interfaces)
// =============================================================================

interface BubbleTypingIndicatorProps {
  typingUsers: TypingEvent[];
  currentUserId?: string;
  className?: string;
}

export const BubbleTypingIndicator: React.FC<BubbleTypingIndicatorProps> = ({
  typingUsers,
  currentUserId,
  className,
}) => {
  const activeUsers = React.useMemo(() => {
    const now = Date.now();
    return typingUsers
      .filter(event => 
        event.isTyping && 
        event.user.id !== currentUserId && 
        now - event.timestamp < 6000
      )
      .map(event => event.user);
  }, [typingUsers, currentUserId]);

  if (activeUsers.length === 0) return null;

  return (
    <div className={cn('flex items-start gap-2', className)}>
      <Avatar className="h-8 w-8">
        {activeUsers[0].image ? (
          <AvatarImage src={activeUsers[0].image} alt={activeUsers[0].name} />
        ) : null}
        <AvatarFallback className="bg-primary/10 text-primary text-xs">
          {getInitials(activeUsers[0].name)}
        </AvatarFallback>
      </Avatar>
      
      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {activeUsers[0].name} is typing
          </span>
          <AnimatedDots />
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default TypingIndicator;
