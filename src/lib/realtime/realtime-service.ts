/**
 * Real-time Service (Ably)
 * High-level service for managing real-time connections, presence, and broadcasts
 * Uses Ably for serverless-compatible WebSocket connections on Vercel
 */

import type * as Ably from 'ably';

import { logger } from '@/lib/logger';

import type {
  ConnectionOptions,
  CursorPosition,
  NotificationEvent,
  PresenceEvent,
  RealtimeClientConfig,
  RealtimeMessage,
  RoomMember,
  TypingEvent,
} from './types';
import { DEFAULT_REALTIME_CONFIG, PresenceStatus, SocketEvent } from './types';

// =============================================================================
// Realtime Service Class
// =============================================================================

export class RealtimeService {
  private client: Ably.Realtime | null = null;
  private channels = new Map<string, Ably.RealtimeChannel>();
  private config: RealtimeClientConfig;
  private connectionOptions: ConnectionOptions | null = null;

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
    this.connectionOptions = options;

    // Dynamic import to avoid bundling Ably in server components
    const { Realtime } = await import('ably');

    this.client = new Realtime({
      authUrl: '/api/realtime/auth',
      authMethod: 'POST' as const,
      authParams: {
        userId: options.userId,
        workspaceId: options.workspaceId || '',
      },
      disconnectedRetryTimeout: this.config.reconnectionDelay || 1000,
    });

    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Ably client initialization failed'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.timeout || 20000);

      const onConnected = () => {
        clearTimeout(timeout);
        this.setupConnectionHandlers();
        this.emit('connected', { timestamp: Date.now() });
        resolve();
      };

      const onError = (stateChange: Ably.ConnectionStateChange) => {
        if (stateChange.reason) {
          clearTimeout(timeout);
          reject(new Error(stateChange.reason.message || 'Connection failed'));
        }
      };

      this.client.connection.on('connected', onConnected);
      this.client.connection.once('failed', onError);
      this.client.connection.once('disconnected', onError);
    });
  }

  private setupConnectionHandlers(): void {
    if (!this.client) return;

    this.client.connection.on('disconnected', (stateChange) => {
      this.emit('disconnected', {
        reason: stateChange.reason?.message || 'disconnected',
        timestamp: Date.now(),
      });
    });

    this.client.connection.on('failed', (stateChange) => {
      this.emit('error', {
        error: stateChange.reason?.message || 'Connection failed',
        timestamp: Date.now(),
      });
    });
  }

  disconnect(): void {
    if (this.client) {
      for (const channel of this.channels.values()) {
        channel.presence.leave();
        channel.off();
      }
      this.channels.clear();

      this.client.connection.off();
      this.client.close();
      this.client = null;
    }

    this.presenceUsers.clear();
    this.typingUsers.clear();
    this.currentRoomId = null;

    this.emit('disconnected', { timestamp: Date.now() });
  }

  isConnected(): boolean {
    return this.client?.connection.state === 'connected';
  }

  // ===========================================================================
  // Channel Management (replaces Socket.io rooms)
  // ===========================================================================

  private getChannel(roomId: string): Ably.RealtimeChannel {
    if (!this.client) throw new Error('Not connected');

    if (!this.channels.has(roomId)) {
      const channel = this.client.channels.get(roomId);
      this.channels.set(roomId, channel);
    }

    return this.channels.get(roomId)!;
  }

  async joinRoom(roomId: string, _type: 'workspace' | 'conversation' | 'private'): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected');
    }

    this.currentRoomId = roomId;
    const channel = this.getChannel(roomId);

    // Enter presence
    await channel.presence.enterClient(this.connectionOptions?.userId || 'anonymous', {
      userId: this.connectionOptions?.userId,
      workspaceId: this.connectionOptions?.workspaceId,
    });

    // Subscribe to events on this channel
    this.setupChannelHandlers(channel, roomId);

    // Get existing members
    const presentMembers = await channel.presence.get();
    for (const member of presentMembers) {
      const data = member.data as Record<string, string> | undefined;
      const userId = data?.userId || member.clientId;
      if (userId) {
        this.presenceUsers.set(userId, {
          socketId: member.id,
          user: { id: userId, name: userId, email: '' },
          joinedAt: new Date(member.timestamp),
          isTyping: false,
          lastActivity: new Date(member.timestamp),
        });
      }
    }

    this.emit('roomJoined', {
      roomId,
      members: Array.from(this.presenceUsers.values()),
    });
  }

  leaveRoom(roomId: string): void {
    const channel = this.channels.get(roomId);
    if (channel) {
      channel.presence.leave();
      channel.off();
      this.channels.delete(roomId);
    }

    if (this.currentRoomId === roomId) {
      this.currentRoomId = null;
    }

    this.presenceUsers.clear();
  }

  // ===========================================================================
  // Typing Indicators
  // ===========================================================================

  startTyping(roomId: string): void {
    const channel = this.getChannel(roomId);
    channel.publish(SocketEvent.TYPING_START, {
      roomId,
      userId: this.connectionOptions?.userId,
      isTyping: true,
      timestamp: Date.now(),
    });
  }

  stopTyping(roomId: string): void {
    const channel = this.getChannel(roomId);
    channel.publish(SocketEvent.TYPING_STOP, {
      roomId,
      userId: this.connectionOptions?.userId,
      isTyping: false,
      timestamp: Date.now(),
    });
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
    const channel = this.getChannel(roomId);
    channel.publish(SocketEvent.CURSOR_MOVE, {
      roomId,
      userId: this.connectionOptions?.userId,
      position,
      timestamp: Date.now(),
    });
  }

  broadcastCursor(roomId: string, x: number, y: number, elementId?: string): void {
    this.updateCursor(roomId, { x, y, elementId });
  }

  // ===========================================================================
  // Messaging
  // ===========================================================================

  sendMessage(roomId: string, content: string, parentId?: string): void {
    const channel = this.getChannel(roomId);
    channel.publish(SocketEvent.MESSAGE_SEND, {
      roomId,
      content,
      parentId,
      userId: this.connectionOptions?.userId,
      timestamp: Date.now(),
    });
  }

  broadcastMessage(roomId: string, content: string, parentId?: string): void {
    this.sendMessage(roomId, content, parentId);
  }

  editMessage(roomId: string, messageId: string, content: string): void {
    const channel = this.getChannel(roomId);
    channel.publish(SocketEvent.MESSAGE_EDIT, {
      roomId,
      messageId,
      content,
      userId: this.connectionOptions?.userId,
      timestamp: Date.now(),
    });
  }

  deleteMessage(roomId: string, messageId: string): void {
    const channel = this.getChannel(roomId);
    channel.publish(SocketEvent.MESSAGE_DELETE, {
      roomId,
      messageId,
      userId: this.connectionOptions?.userId,
      timestamp: Date.now(),
    });
  }

  // ===========================================================================
  // Presence
  // ===========================================================================

  getOnlineUsers(): RoomMember[] {
    return Array.from(this.presenceUsers.values());
  }

  isUserOnline(userId: string): boolean {
    return this.presenceUsers.has(userId);
  }

  // ===========================================================================
  // Notifications
  // ===========================================================================

  notifyUser(userId: string, notification: Omit<NotificationEvent, 'id' | 'timestamp'>): void {
    if (!this.client) return;

    const channel = this.client.channels.get(`notifications:${userId}`);
    channel.publish(SocketEvent.NOTIFY_USER, {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
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
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error: unknown) {
          logger.debug('Event handler threw an error', {
            event,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
  }

  // ===========================================================================
  // Ably Channel Event Handlers
  // ===========================================================================

  private setupChannelHandlers(channel: Ably.RealtimeChannel, roomId: string): void {
    const userId = this.connectionOptions?.userId || '';

    // Typing events
    channel.subscribe(SocketEvent.TYPING_START, (message: Ably.Message) => {
      const data = message.data as { userId?: string; isTyping?: boolean; timestamp?: number };
      if (!data.userId || data.userId === userId) return;

      const event: TypingEvent = {
        user: { id: data.userId, name: data.userId, email: '' },
        roomId,
        isTyping: true,
        timestamp: data.timestamp || Date.now(),
      };
      this.typingUsers.set(data.userId, event);
      this.emit('typing', event);
    });

    channel.subscribe(SocketEvent.TYPING_STOP, (message: Ably.Message) => {
      const data = message.data as { userId?: string };
      if (!data.userId) return;

      this.typingUsers.delete(data.userId);
      this.emit('typing', {
        user: { id: data.userId, name: data.userId, email: '' },
        roomId,
        isTyping: false,
        timestamp: Date.now(),
      });
    });

    // Cursor events
    channel.subscribe(SocketEvent.CURSOR_MOVE, (message: Ably.Message) => {
      const data = message.data as {
        userId?: string;
        position: CursorPosition;
        timestamp: number;
      };
      if (!data.userId || data.userId === userId) return;

      this.emit('cursor', {
        user: { id: data.userId, name: data.userId, email: '' },
        position: data.position,
        timestamp: data.timestamp,
      });
    });

    // Message events
    channel.subscribe(SocketEvent.MESSAGE_SEND, (message: Ably.Message) => {
      const data = message.data as RealtimeMessage;
      this.emit('message', data);
    });

    channel.subscribe(SocketEvent.MESSAGE_EDIT, (message: Ably.Message) => {
      const data = message.data as {
        messageId: string;
        content: string;
        userId: string;
        timestamp: number;
      };
      this.emit('messageEdit', data);
    });

    channel.subscribe(SocketEvent.MESSAGE_DELETE, (message: Ably.Message) => {
      const data = message.data as { messageId: string; userId: string; timestamp: number };
      this.emit('messageDelete', data);
    });

    // Presence events via Ably
    channel.presence.subscribe('enter', (member: Ably.PresenceMessage) => {
      const data = member.data as Record<string, string> | undefined;
      const memberId = data?.userId || member.clientId;
      if (!memberId) return;

      const presenceEvent: PresenceEvent = {
        user: { id: memberId, name: memberId, email: '' },
        roomId,
        status: PresenceStatus.ONLINE,
        timestamp: Date.now(),
      };

      this.presenceUsers.set(memberId, {
        socketId: member.id,
        user: presenceEvent.user,
        joinedAt: new Date(),
        isTyping: false,
        lastActivity: new Date(),
      });

      this.emit('presenceJoin', presenceEvent);
    });

    channel.presence.subscribe('leave', (member: Ably.PresenceMessage) => {
      const data = member.data as Record<string, string> | undefined;
      const memberId = data?.userId || member.clientId;
      if (!memberId) return;

      const presenceEvent: PresenceEvent = {
        user: { id: memberId, name: memberId, email: '' },
        roomId,
        status: PresenceStatus.OFFLINE,
        timestamp: Date.now(),
      };

      this.presenceUsers.delete(memberId);
      this.typingUsers.delete(memberId);
      this.emit('presenceLeave', presenceEvent);
    });
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
