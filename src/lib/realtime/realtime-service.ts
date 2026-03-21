/**
 * Real-time Service
 * High-level service for managing real-time connections, presence, and broadcasts
 * Abstracts WebSocket and SSE implementations
 */

import type { Socket } from 'socket.io-client';

import type {
  ConnectionOptions,
  CursorPosition,
  NotificationEvent,
  PresenceEvent,
  RealtimeClientConfig,
  RealtimeMessage,
  RoomMember,
  TypingEvent,
  UserInfo,
} from './types';
import { DEFAULT_REALTIME_CONFIG, SocketEvent } from './types';

// =============================================================================
// Realtime Service Class
// =============================================================================

export class RealtimeService {
  private socket: Socket | null = null;
  private eventSource: EventSource | null = null;
  private config: RealtimeClientConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private connectionOptions: ConnectionOptions | null = null;
  private presenceInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // Event handlers
  private eventHandlers = new Map<string, Set<(data: unknown) => void>>();

  // Presence tracking
  private presenceUsers = new Map<string, RoomMember>();
  private typingUsers = new Map<string, TypingEvent>();

  // Current room
  private currentRoomId: string | null = null;

  constructor(config: Partial<RealtimeClientConfig> = {}) {
    this.config = { ...DEFAULT_REALTIME_CONFIG, ...config };
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  async connect(options: ConnectionOptions): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      return;
    }

    this.isConnecting = true;
    this.connectionOptions = options;

    try {
      // Try WebSocket first
      await this.connectWebSocket(options);
    } catch (error) {
      // Fall back to SSE if enabled
      if (this.config.fallbackToSSE) {
        await this.connectSSE(options);
      } else {
        throw error;
      }
    } finally {
      this.isConnecting = false;
    }
  }

  private async connectWebSocket(options: ConnectionOptions): Promise<void> {
    const { io } = await import('socket.io-client');

    const url = this.config.url || window.location.origin;

    this.socket = io(url, {
      path: '/api/socket/io',
      auth: {
        token: options.authToken,
      },
      reconnection: this.config.reconnection,
      reconnectionAttempts: this.config.reconnectionAttempts,
      reconnectionDelay: this.config.reconnectionDelay,
      reconnectionDelayMax: this.config.reconnectionDelayMax,
      timeout: this.config.timeout,
      transports: this.config.transports,
    });

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket initialization failed'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.timeout);

      this.socket.on(SocketEvent.CONNECT, () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        this.setupSocketHandlers();
        this.startHeartbeat();
        this.emit('connected', { timestamp: Date.now() });
        resolve();
      });

      this.socket.on(SocketEvent.CONNECT_ERROR, (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async connectSSE(options: ConnectionOptions): Promise<void> {
    const params = new URLSearchParams({
      userId: options.userId,
      ...(options.workspaceId && { workspaceId: options.workspaceId }),
      ...(options.conversationId && { conversationId: options.conversationId }),
    });

    const url = `/api/realtime/events?${params}`;

    this.eventSource = new EventSource(url);

    return new Promise((resolve, reject) => {
      if (!this.eventSource) {
        reject(new Error('EventSource initialization failed'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('SSE connection timeout'));
      }, this.config.timeout);

      this.eventSource.onopen = () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;
        this.setupSSEHandlers();
        this.emit('connected', { timestamp: Date.now(), transport: 'sse' });
        resolve();
      };

      this.eventSource.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.stopPresenceUpdates();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.presenceUsers.clear();
    this.typingUsers.clear();
    this.currentRoomId = null;

    this.emit('disconnected', { timestamp: Date.now() });
  }

  isConnected(): boolean {
    return !!(
      this.socket?.connected ||
      (this.eventSource && this.eventSource.readyState === EventSource.OPEN)
    );
  }

  // ===========================================================================
  // Room Management
  // ===========================================================================

  async joinRoom(roomId: string, type: 'workspace' | 'conversation' | 'private'): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    this.currentRoomId = roomId;

    if (this.socket) {
      this.socket.emit(SocketEvent.JOIN_ROOM, {
        roomId,
        type,
        workspaceId: this.connectionOptions?.workspaceId,
        conversationId: this.connectionOptions?.conversationId,
      });
    }

    // Start presence updates
    this.startPresenceUpdates();
  }

  leaveRoom(roomId: string): void {
    if (this.socket) {
      this.socket.emit(SocketEvent.LEAVE_ROOM, { roomId });
    }

    if (this.currentRoomId === roomId) {
      this.currentRoomId = null;
      this.stopPresenceUpdates();
    }

    // Clear room-specific data
    for (const [key, value] of this.presenceUsers.entries()) {
      if (value.socketId) {
        this.presenceUsers.delete(key);
      }
    }
  }

  // ===========================================================================
  // Typing Indicators
  // ===========================================================================

  startTyping(roomId: string): void {
    if (this.socket) {
      this.socket.emit(SocketEvent.TYPING_START, { roomId });
    }
  }

  stopTyping(roomId: string): void {
    if (this.socket) {
      this.socket.emit(SocketEvent.TYPING_STOP, { roomId });
    }
  }

  broadcastTyping(roomId: string, isTyping: boolean): void {
    if (isTyping) {
      this.startTyping(roomId);
    } else {
      this.stopTyping(roomId);
    }
  }

  getTypingUsers(): TypingEvent[] {
    const now = Date.now();
    const active: TypingEvent[] = [];

    for (const event of this.typingUsers.values()) {
      // Only show typing if within last 6 seconds
      if (now - event.timestamp < 6000 && event.isTyping) {
        active.push(event);
      }
    }

    return active;
  }

  // ===========================================================================
  // Cursor Sync
  // ===========================================================================

  updateCursor(roomId: string, position: CursorPosition): void {
    if (!this.socket) return;

    this.socket.emit(SocketEvent.CURSOR_MOVE, { roomId, position });
  }

  broadcastCursor(roomId: string, x: number, y: number, elementId?: string): void {
    this.updateCursor(roomId, { x, y, elementId });
  }

  // ===========================================================================
  // Messaging
  // ===========================================================================

  sendMessage(roomId: string, content: string, parentId?: string): void {
    if (!this.socket) {
      throw new Error('WebSocket required for sending messages');
    }

    this.socket.emit(SocketEvent.MESSAGE_SEND, {
      roomId,
      content,
      parentId,
    });
  }

  broadcastMessage(roomId: string, content: string, parentId?: string): void {
    this.sendMessage(roomId, content, parentId);
  }

  editMessage(roomId: string, messageId: string, content: string): void {
    if (!this.socket) return;

    this.socket.emit(SocketEvent.MESSAGE_EDIT, {
      roomId,
      messageId,
      content,
    });
  }

  deleteMessage(roomId: string, messageId: string): void {
    if (!this.socket) return;

    this.socket.emit(SocketEvent.MESSAGE_DELETE, {
      roomId,
      messageId,
    });
  }

  // ===========================================================================
  // Presence
  // ===========================================================================

  private startPresenceUpdates(): void {
    if (this.presenceInterval) return;

    // Send presence heartbeat every 30 seconds
    this.presenceInterval = setInterval(() => {
      if (this.currentRoomId && this.socket) {
        this.socket.emit('presence_ping', {
          roomId: this.currentRoomId,
          timestamp: Date.now(),
        });
      }
    }, 30000);
  }

  private stopPresenceUpdates(): void {
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
  }

  getOnlineUsers(): RoomMember[] {
    return Array.from(this.presenceUsers.values());
  }

  isUserOnline(userId: string): boolean {
    for (const member of this.presenceUsers.values()) {
      if (member.user.id === userId) return true;
    }
    return false;
  }

  // ===========================================================================
  // Notifications
  // ===========================================================================

  notifyUser(userId: string, notification: Omit<NotificationEvent, 'id' | 'timestamp'>): void {
    if (!this.socket) return;

    this.socket.emit(SocketEvent.NOTIFY_USER, {
      targetUserId: userId,
      notification: {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      },
    });
  }

  // ===========================================================================
  // Event Handling
  // ===========================================================================

  on<T>(event: string, handler: (data: T) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    const handlers = this.eventHandlers.get(event);
    if (!handlers) return () => {};
    const wrappedHandler = handler as (data: unknown) => void;
    handlers.add(wrappedHandler);

    // Return unsubscribe function
    return () => {
      handlers.delete(wrappedHandler);
    };
  }

  off(event: string, handler: (data: unknown) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (_error) {}
      });
    }
  }

  // ===========================================================================
  // Socket Event Handlers
  // ===========================================================================

  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.on(SocketEvent.DISCONNECT, (reason: string) => {
      this.emit('disconnected', { reason, timestamp: Date.now() });

      // Attempt reconnection if not manually disconnected
      if (reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
    });

    this.socket.on(SocketEvent.CONNECT_ERROR, (error: Error) => {
      this.emit('error', { error: error.message, timestamp: Date.now() });
      this.scheduleReconnect();
    });

    this.socket.on(SocketEvent.ROOM_JOINED, (data: { roomId: string; members: RoomMember[] }) => {
      // Update presence users
      for (const member of data.members) {
        this.presenceUsers.set(member.user.id, member as RoomMember);
      }
      this.emit('roomJoined', data);
    });

    this.socket.on(SocketEvent.USER_TYPING, (data: TypingEvent) => {
      if (data.isTyping) {
        this.typingUsers.set(data.user.id, data);
      } else {
        this.typingUsers.delete(data.user.id);
      }
      this.emit('typing', data);
    });

    this.socket.on(
      SocketEvent.CURSOR_UPDATE,
      (data: { user: UserInfo; position: CursorPosition; timestamp: number }) => {
        this.emit('cursor', data);
      }
    );

    this.socket.on(SocketEvent.MESSAGE_RECEIVE, (data: RealtimeMessage) => {
      this.emit('message', data);
    });

    this.socket.on(
      SocketEvent.MESSAGE_EDIT,
      (data: { messageId: string; content: string; userId: string; timestamp: number }) => {
        this.emit('messageEdit', data);
      }
    );

    this.socket.on(
      SocketEvent.MESSAGE_DELETE,
      (data: { messageId: string; userId: string; timestamp: number }) => {
        this.emit('messageDelete', data);
      }
    );

    this.socket.on(SocketEvent.PRESENCE_JOIN, (data: PresenceEvent) => {
      const member: RoomMember = {
        socketId: '', // Unknown for remote users
        user: data.user,
        joinedAt: new Date(data.timestamp),
        isTyping: false,
        lastActivity: new Date(data.timestamp),
      };
      this.presenceUsers.set(data.user.id, member);
      this.emit('presenceJoin', data);
    });

    this.socket.on(SocketEvent.PRESENCE_LEAVE, (data: PresenceEvent) => {
      this.presenceUsers.delete(data.user.id);
      this.typingUsers.delete(data.user.id);
      this.emit('presenceLeave', data);
    });

    this.socket.on(SocketEvent.NOTIFICATION, (data: NotificationEvent) => {
      this.emit('notification', data);
    });

    this.socket.on(SocketEvent.ERROR, (data: { code: string; message: string }) => {
      this.emit('error', data);
    });

    this.socket.on(SocketEvent.RATE_LIMITED, (data: { event: string; retryAfter: number }) => {
      this.emit('rateLimited', data);
    });
  }

  // ===========================================================================
  // SSE Event Handlers
  // ===========================================================================

  private setupSSEHandlers(): void {
    if (!this.eventSource) return;

    this.eventSource.addEventListener('message', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      this.emit('message', data);
    });

    this.eventSource.addEventListener('typing', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      this.emit('typing', data);
    });

    this.eventSource.addEventListener('presence', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      this.emit('presence', data);
    });

    this.eventSource.addEventListener('cursor', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      this.emit('cursor', data);
    });

    this.eventSource.addEventListener('notification', (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      this.emit('notification', data);
    });

    this.eventSource.addEventListener('ping', () => {
      // Keep connection alive
    });

    this.eventSource.onerror = (error) => {
      this.emit('error', { error, timestamp: Date.now() });
      this.scheduleReconnect();
    };
  }

  // ===========================================================================
  // Heartbeat & Reconnection
  // ===========================================================================

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping', { timestamp: Date.now() });
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || !this.config.reconnection) return;

    if (this.reconnectAttempts >= (this.config.reconnectionAttempts || 5)) {
      this.emit('error', {
        message: 'Max reconnection attempts reached',
        timestamp: Date.now(),
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      (this.config.reconnectionDelay || 1000) * 2 ** (this.reconnectAttempts - 1),
      this.config.reconnectionDelayMax || 5000
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.connectionOptions) {
        this.connect(this.connectionOptions).catch(() => {
          // Reconnection failed, will retry
        });
      }
    }, delay);
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let realtimeService: RealtimeService | null = null;

export function getRealtimeService(config?: Partial<RealtimeClientConfig>): RealtimeService {
  if (!realtimeService) {
    realtimeService = new RealtimeService(config);
  }
  return realtimeService;
}

export function createRealtimeService(config?: Partial<RealtimeClientConfig>): RealtimeService {
  return new RealtimeService(config);
}
