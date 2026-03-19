/**
 * useRealtime Hook
 * React hook for managing WebSocket/SSE connections
 * Provides connection state, room management, and event handling
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';

import {
  RealtimeService,
  createRealtimeService,
  type RealtimeClientConfig,
  type RoomMember,
  type UserInfo,
  type RealtimeMessage,
  type TypingEvent,
  type PresenceEvent,
  type CursorPosition,
  type NotificationEvent,
  DEFAULT_REALTIME_CONFIG,
} from '@/lib/realtime';

// =============================================================================
// Types
// =============================================================================

interface UseRealtimeOptions {
  roomId?: string;
  roomType?: 'workspace' | 'conversation' | 'private';
  autoConnect?: boolean;
  onMessage?: (message: RealtimeMessage) => void;
  onTyping?: (event: TypingEvent) => void;
  onPresence?: (event: PresenceEvent) => void;
  onCursor?: (event: { user: UserInfo; position: CursorPosition; timestamp: number }) => void;
  onNotification?: (notification: NotificationEvent) => void;
  onError?: (error: Error) => void;
  config?: Partial<RealtimeClientConfig>;
}

interface UseRealtimeReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  reconnectAttempts: number;
  
  // Room state
  currentRoomId: string | null;
  onlineUsers: RoomMember[];
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  joinRoom: (roomId: string, type?: 'workspace' | 'conversation' | 'private') => Promise<void>;
  leaveRoom: (roomId: string) => void;
  sendMessage: (content: string, parentId?: string) => void;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeReturn {
  const {
    roomId: initialRoomId,
    roomType = 'conversation',
    autoConnect = true,
    onMessage,
    onTyping,
    onPresence,
    onCursor,
    onNotification,
    onError,
    config: customConfig,
  } = options;

  const { data: session } = useSession();
  
  // Service ref to maintain instance across renders
  const serviceRef = useRef<RealtimeService | null>(null);
  
  // State
  const [connectionState, setConnectionState] = useState<{
    isConnected: boolean;
    isConnecting: boolean;
    error: Error | null;
    reconnectAttempts: number;
  }>({
    isConnected: false,
    isConnecting: false,
    error: null,
    reconnectAttempts: 0,
  });
  
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(initialRoomId || null);
  const [onlineUsers, setOnlineUsers] = useState<RoomMember[]>([]);

  // Initialize service
  useEffect(() => {
    if (!serviceRef.current) {
      const config: RealtimeClientConfig = {
        ...DEFAULT_REALTIME_CONFIG,
        ...customConfig,
        url: typeof window !== 'undefined' ? window.location.origin : undefined,
      };
      serviceRef.current = createRealtimeService(config);
    }

    return () => {
      // Don't disconnect on unmount to allow persistent connections
      // Disconnect only if explicitly requested
    };
  }, [customConfig]);

  const service = serviceRef.current;

  // Setup event handlers
  useEffect(() => {
    if (!service) return;

    const unsubscribers: Array<() => void> = [];

    // Connection events
    unsubscribers.push(
      service.on('connected', () => {
        setConnectionState((prev: { isConnected: boolean; isConnecting: boolean; error: Error | null; reconnectAttempts: number }) => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
          reconnectAttempts: 0,
        }));
      })
    );

    unsubscribers.push(
      service.on('disconnected', () => {
        setConnectionState((prev: { isConnected: boolean; isConnecting: boolean; error: Error | null; reconnectAttempts: number }) => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));
      })
    );

    unsubscribers.push(
      service.on('error', ({ error, message }: { error?: Error; message?: string }) => {
        const err = error || new Error(message || 'Unknown error');
        setConnectionState(prev => ({
          ...prev,
          error: err,
        }));
        onError?.(err);
      })
    );

    // Room events
    unsubscribers.push(
      service.on('roomJoined', ({ roomId, members }: { roomId: string; members: RoomMember[] }) => {
        setCurrentRoomId(roomId);
        setOnlineUsers(members);
      })
    );

    // Message events
    if (onMessage) {
      unsubscribers.push(service.on('message', onMessage));
    }

    // Typing events
    unsubscribers.push(
      service.on('typing', (event: TypingEvent) => {
        onTyping?.(event);
      })
    );

    // Presence events
    unsubscribers.push(
      service.on('presenceJoin', (event: PresenceEvent) => {
        setOnlineUsers(prev => {
          const exists = prev.some(u => u.user.id === event.user.id);
          if (exists) return prev;
          return [...prev, {
            socketId: '',
            user: event.user,
            joinedAt: new Date(event.timestamp),
            isTyping: false,
            lastActivity: new Date(event.timestamp),
          }];
        });
        onPresence?.(event);
      })
    );

    unsubscribers.push(
      service.on('presenceLeave', (event: PresenceEvent) => {
        setOnlineUsers(prev => prev.filter(u => u.user.id !== event.user.id));
        onPresence?.(event);
      })
    );

    // Cursor events
    if (onCursor) {
      unsubscribers.push(service.on('cursor', onCursor));
    }

    // Notification events
    if (onNotification) {
      unsubscribers.push(service.on('notification', onNotification));
    }

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [service, onMessage, onTyping, onPresence, onCursor, onNotification, onError]);

  // Auto-connect
  useEffect(() => {
    if (autoConnect && session?.user?.id && !connectionState.isConnected && !connectionState.isConnecting) {
      connect();
    }
  }, [autoConnect, session?.user?.id, connectionState.isConnected, connectionState.isConnecting]);

  // Auto-join room
  useEffect(() => {
    if (connectionState.isConnected && currentRoomId && service) {
      service.joinRoom(currentRoomId, roomType);
    }
  }, [connectionState.isConnected, currentRoomId, roomType, service]);

  // Actions
  const connect = useCallback(async (): Promise<void> => {
    if (!service || !session?.user?.id) return;
    
    setConnectionState((prev: { isConnected: boolean; isConnecting: boolean; error: Error | null; reconnectAttempts: number }) => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      await service.connect({
        userId: session.user.id,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setConnectionState((prev: { isConnected: boolean; isConnecting: boolean; error: Error | null; reconnectAttempts: number }) => ({
        ...prev,
        isConnecting: false,
        error: err,
      }));
      throw err;
    }
  }, [service, session?.user?.id]);

  const disconnect = useCallback((): void => {
    service?.disconnect();
    setConnectionState({
      isConnected: false,
      isConnecting: false,
      error: null,
      reconnectAttempts: 0,
    });
    setCurrentRoomId(null);
    setOnlineUsers([]);
  }, [service]);

  const joinRoom = useCallback(async (
    roomId: string, 
    type: 'workspace' | 'conversation' | 'private' = roomType
  ): Promise<void> => {
    if (!service) return;
    
    setCurrentRoomId(roomId);
    await service.joinRoom(roomId, type);
  }, [service, roomType]);

  const leaveRoom = useCallback((roomId: string): void => {
    service?.leaveRoom(roomId);
    if (currentRoomId === roomId) {
      setCurrentRoomId(null);
      setOnlineUsers([]);
    }
  }, [service, currentRoomId]);

  const sendMessage = useCallback((content: string, parentId?: string): void => {
    if (!service || !currentRoomId) return;
    service.sendMessage(currentRoomId, content, parentId);
  }, [service, currentRoomId]);

  const editMessage = useCallback((messageId: string, content: string): void => {
    if (!service || !currentRoomId) return;
    service.editMessage(currentRoomId, messageId, content);
  }, [service, currentRoomId]);

  const deleteMessage = useCallback((messageId: string): void => {
    if (!service || !currentRoomId) return;
    service.deleteMessage(currentRoomId, messageId);
  }, [service, currentRoomId]);

  return {
    isConnected: connectionState.isConnected,
    isConnecting: connectionState.isConnecting,
    error: connectionState.error,
    reconnectAttempts: connectionState.reconnectAttempts,
    currentRoomId,
    onlineUsers,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    sendMessage,
    editMessage,
    deleteMessage,
  };
}

// =============================================================================
// useTypingIndicator Hook
// =============================================================================

interface UseTypingIndicatorOptions {
  roomId: string;
  user: UserInfo;
  delay?: number;
}

interface UseTypingIndicatorReturn {
  isTyping: boolean;
  typingUsers: TypingEvent[];
  startTyping: () => void;
  stopTyping: () => void;
}

export function useTypingIndicator(
  service: RealtimeService | null,
  options: UseTypingIndicatorOptions
): UseTypingIndicatorReturn {
  const { roomId, delay = 5000 } = options;
  
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingEvent[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!service) return;

    const unsubscribe = service.on('typing', (event: TypingEvent) => {
      setTypingUsers(prev => {
        if (event.isTyping) {
          const filtered = prev.filter(u => u.user.id !== event.user.id);
          return [...filtered, event];
        } else {
          return prev.filter(u => u.user.id !== event.user.id);
        }
      });

      // Auto-remove after delay
      if (event.isTyping) {
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.user.id !== event.user.id));
        }, delay + 1000);
      }
    });

    return unsubscribe;
  }, [service, delay]);

  const startTyping = useCallback(() => {
    if (!service || isTyping) return;
    
    setIsTyping(true);
    service.startTyping(roomId);

    // Auto-stop after delay
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, delay);
  }, [service, roomId, isTyping, delay]);

  const stopTyping = useCallback(() => {
    if (!service || !isTyping) return;
    
    setIsTyping(false);
    service.stopTyping(roomId);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [service, roomId, isTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (service && isTyping) {
        service.stopTyping(roomId);
      }
    };
  }, [service, roomId, isTyping]);

  return {
    isTyping,
    typingUsers: useMemo(() => 
      typingUsers.filter(u => Date.now() - u.timestamp < delay),
    [typingUsers, delay]),
    startTyping,
    stopTyping,
  };
}

// =============================================================================
// usePresence Hook
// =============================================================================

interface UsePresenceOptions {
  roomId: string;
}

interface UsePresenceReturn {
  onlineUsers: RoomMember[];
  onlineCount: number;
  isUserOnline: (userId: string) => boolean;
}

export function usePresence(
  service: RealtimeService | null,
  options: UsePresenceOptions
): UsePresenceReturn {
  const { roomId } = options;
  const [onlineUsers, setOnlineUsers] = useState<RoomMember[]>([]);

  useEffect(() => {
    if (!service) return;

    // Get initial users
    setOnlineUsers(service.getOnlineUsers());

    const unsubscribeJoin = service.on('presenceJoin', (event: PresenceEvent) => {
      if (event.roomId === roomId) {
        setOnlineUsers(prev => {
          const exists = prev.some(u => u.user.id === event.user.id);
          if (exists) return prev;
          return [...prev, {
            socketId: '',
            user: event.user,
            joinedAt: new Date(event.timestamp),
            isTyping: false,
            lastActivity: new Date(event.timestamp),
          }];
        });
      }
    });

    const unsubscribeLeave = service.on('presenceLeave', (event: PresenceEvent) => {
      if (event.roomId === roomId) {
        setOnlineUsers(prev => prev.filter(u => u.user.id !== event.user.id));
      }
    });

    return () => {
      unsubscribeJoin();
      unsubscribeLeave();
    };
  }, [service, roomId]);

  const isUserOnline = useCallback((userId: string): boolean => {
    return onlineUsers.some(u => u.user.id === userId);
  }, [onlineUsers]);

  return {
    onlineUsers,
    onlineCount: onlineUsers.length,
    isUserOnline,
  };
}

// =============================================================================
// useCursorSync Hook
// =============================================================================

interface CursorState {
  user: UserInfo;
  position: CursorPosition;
  timestamp: number;
}

interface UseCursorSyncOptions {
  roomId: string;
  containerRef?: React.RefObject<HTMLElement | null>;
}

interface UseCursorSyncReturn {
  cursors: Map<string, CursorState>;
  updateCursor: (position: CursorPosition) => void;
}

export function useCursorSync(
  service: RealtimeService | null,
  options: UseCursorSyncOptions
): UseCursorSyncReturn {
  const { roomId, containerRef } = options;
  const [cursors, setCursors] = useState<Map<string, CursorState>>(new Map());
  const throttleRef = useRef<number>(0);

  useEffect(() => {
    if (!service) return;

    const unsubscribe = service.on('cursor', (event: { 
      user: UserInfo; 
      position: CursorPosition; 
      timestamp: number;
    }) => {
      setCursors(prev => {
        const next = new Map(prev);
        next.set(event.user.id, {
          user: event.user,
          position: event.position,
          timestamp: event.timestamp,
        });
        return next;
      });

      // Auto-remove stale cursors after 30 seconds
      setTimeout(() => {
        setCursors(prev => {
          const cursor = prev.get(event.user.id);
          if (cursor && Date.now() - cursor.timestamp > 30000) {
            const next = new Map(prev);
            next.delete(event.user.id);
            return next;
          }
          return prev;
        });
      }, 30000);
    });

    return unsubscribe;
  }, [service]);

  // Track local cursor movement
  useEffect(() => {
    if (!service || !containerRef?.current) return;

    const container = containerRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      // Throttle to 20 updates per second
      if (now - throttleRef.current < 50) return;
      throttleRef.current = now;

      const rect = container.getBoundingClientRect();
      const position: CursorPosition = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      service.updateCursor(roomId, position);
    };

    container.addEventListener('mousemove', handleMouseMove);
    return () => container.removeEventListener('mousemove', handleMouseMove);
  }, [service, roomId, containerRef]);

  const updateCursor = useCallback((position: CursorPosition) => {
    service?.updateCursor(roomId, position);
  }, [service, roomId]);

  return {
    cursors,
    updateCursor,
  };
}
