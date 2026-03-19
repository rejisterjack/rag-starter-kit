/**
 * WebSocket Server using Socket.io for Next.js
 * Provides real-time collaboration features with room management,
 * authentication, and rate limiting
 */

import { Server as NetServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

import { auth } from '@/lib/auth';
// Rate limiter imported dynamically when needed
import { logAuditEvent, AuditEvent } from '@/lib/audit/audit-logger';

import {
  SocketEvent,
  Room,
  RoomType,
  RoomMember,
  UserInfo,
  CursorPosition,
  RealtimeServerConfig,
  DEFAULT_SERVER_CONFIG,
  RateLimitState,
  TypingEvent,
  RealtimeMessage,
  PresenceEvent,
  PresenceStatus,
  NotificationEvent,
} from './types';

// =============================================================================
// Global State
// =============================================================================

declare global {
  // eslint-disable-next-line no-var
  var io: SocketIOServer | undefined;
}

// Room storage
const rooms = new Map<string, Room>();

// Rate limiting per socket
const rateLimits = new Map<string, RateLimitState>();

// =============================================================================
// WebSocket Server Class
// =============================================================================

export class WebSocketServer {
  private io: SocketIOServer;
  private config: RealtimeServerConfig;

  constructor(server: NetServer, config: Partial<RealtimeServerConfig> = {}) {
    this.config = { ...DEFAULT_SERVER_CONFIG, ...config };
    
    this.io = new SocketIOServer(server, {
      path: '/api/socket/io',
      addTrailingSlash: false,
      cors: {
        origin: this.config.corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: this.config.pingTimeout,
      pingInterval: this.config.pingInterval,
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    // Store globally for access in other modules
    globalThis.io = this.io;
  }

  // ===========================================================================
  // Middleware
  // ===========================================================================

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token as string | undefined;
        const session = await auth();

        if (!session?.user?.id) {
          // Check if token is provided for API key auth
          if (!token) {
            return next(new Error('Authentication required'));
          }
          // TODO: Validate API key token
        }

        // Attach user info to socket
        socket.data.user = {
          id: session?.user?.id || 'anonymous',
          name: session?.user?.name || 'Anonymous',
          email: session?.user?.email || '',
          image: session?.user?.image,
          role: session?.user?.role || 'USER',
        } as UserInfo;

        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    // Rate limiting middleware
    this.io.use((socket: Socket, next) => {
      const clientId = socket.data.user?.id || socket.id;
      
      if (this.isRateLimited(clientId)) {
        logAuditEvent({
          event: AuditEvent.RATE_LIMIT_HIT,
          userId: socket.data.user?.id,
          metadata: {
            socketId: socket.id,
            type: 'websocket_connection',
          },
          severity: 'WARNING',
        });
        return next(new Error('Rate limit exceeded'));
      }

      next();
    });
  }

  // ===========================================================================
  // Event Handlers
  // ===========================================================================

  private setupEventHandlers(): void {
    this.io.on(SocketEvent.CONNECT, (socket: Socket) => {
      console.log(`Socket connected: ${socket.id}, User: ${socket.data.user?.id}`);

      this.handleJoinRoom(socket);
      this.handleLeaveRoom(socket);
      this.handleTyping(socket);
      this.handleCursor(socket);
      this.handleMessage(socket);
      this.handleDisconnect(socket);

      // Notify client of successful connection
      socket.emit('connected', {
        socketId: socket.id,
        user: socket.data.user,
        timestamp: Date.now(),
      });
    });
  }

  // ===========================================================================
  // Room Management
  // ===========================================================================

  private handleJoinRoom(socket: Socket): void {
    socket.on(SocketEvent.JOIN_ROOM, async (data: { 
      roomId: string; 
      type: RoomType;
      workspaceId?: string;
      conversationId?: string;
    }) => {
      try {
        const { roomId, type, workspaceId, conversationId } = data;
        const user = socket.data.user as UserInfo;

        // Check rate limit for room joins
        if (this.isRateLimited(user.id, 'join')) {
          socket.emit(SocketEvent.RATE_LIMITED, {
            event: SocketEvent.JOIN_ROOM,
            retryAfter: this.getRateLimitReset(user.id),
          });
          return;
        }

        // Get or create room
        let room = rooms.get(roomId);
        if (!room) {
          room = {
            id: roomId,
            type,
            workspaceId,
            conversationId,
            members: new Map(),
            createdAt: new Date(),
          };
          rooms.set(roomId, room);
        }

        // Check room capacity
        if (room.members.size >= this.config.maxClientsPerRoom) {
          socket.emit(SocketEvent.ERROR, {
            code: 'ROOM_FULL',
            message: 'Room has reached maximum capacity',
          });
          return;
        }

        // Leave previous rooms of the same type
        this.leaveRoomsOfType(socket, type);

        // Join the room
        await socket.join(roomId);

        // Add member to room
        const member: RoomMember = {
          socketId: socket.id,
          user,
          joinedAt: new Date(),
          isTyping: false,
          lastActivity: new Date(),
        };
        room.members.set(socket.id, member);

        // Notify socket of successful join
        socket.emit(SocketEvent.ROOM_JOINED, {
          roomId,
          members: Array.from(room.members.values()).map(m => ({
            user: m.user,
            joinedAt: m.joinedAt,
            isTyping: m.isTyping,
          })),
        });

        // Notify other members
        socket.to(roomId).emit(SocketEvent.PRESENCE_JOIN, {
          user,
          roomId,
          status: PresenceStatus.ONLINE,
          timestamp: Date.now(),
        } as PresenceEvent);

        // Log join event
        await logAuditEvent({
          event: AuditEvent.CHAT_CREATED,
          userId: user.id,
          workspaceId,
          metadata: {
            roomId,
            type,
            conversationId,
          },
        });

      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit(SocketEvent.ERROR, {
          code: 'JOIN_FAILED',
          message: 'Failed to join room',
        });
      }
    });
  }

  private handleLeaveRoom(socket: Socket): void {
    socket.on(SocketEvent.LEAVE_ROOM, (data: { roomId: string }) => {
      const { roomId } = data;
      const user = socket.data.user as UserInfo;

      this.leaveRoom(socket, roomId);

      socket.emit(SocketEvent.ROOM_LEFT, { roomId });

      // Notify other members
      socket.to(roomId).emit(SocketEvent.PRESENCE_LEAVE, {
        user,
        roomId,
        status: PresenceStatus.OFFLINE,
        timestamp: Date.now(),
      } as PresenceEvent);
    });
  }

  private leaveRoom(socket: Socket, roomId: string): void {
    const room = rooms.get(roomId);
    if (room) {
      room.members.delete(socket.id);
      
      // Clean up empty rooms
      if (room.members.size === 0) {
        rooms.delete(roomId);
      }
    }
    
    socket.leave(roomId);
  }

  private leaveRoomsOfType(socket: Socket, type: RoomType): void {
    for (const [roomId, room] of rooms.entries()) {
      if (room.type === type && room.members.has(socket.id)) {
        this.leaveRoom(socket, roomId);
      }
    }
  }

  // ===========================================================================
  // Typing Indicators
  // ===========================================================================

  private handleTyping(socket: Socket): void {
    if (!this.config.enableTyping) return;

    const typingTimeouts = new Map<string, NodeJS.Timeout>();

    socket.on(SocketEvent.TYPING_START, (data: { roomId: string }) => {
      const { roomId } = data;
      const user = socket.data.user as UserInfo;

      if (this.isRateLimited(`${user.id}:typing`, 'typing')) {
        return;
      }

      const room = rooms.get(roomId);
      if (!room) return;

      const member = room.members.get(socket.id);
      if (member) {
        member.isTyping = true;
        member.lastActivity = new Date();
      }

      // Clear existing timeout
      const existingTimeout = typingTimeouts.get(socket.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Broadcast typing start
      socket.to(roomId).emit(SocketEvent.USER_TYPING, {
        user,
        roomId,
        isTyping: true,
        timestamp: Date.now(),
      } as TypingEvent);

      // Auto-stop typing after 5 seconds
      const timeout = setTimeout(() => {
        this.stopTyping(socket, roomId);
      }, 5000);
      
      typingTimeouts.set(socket.id, timeout);
    });

    socket.on(SocketEvent.TYPING_STOP, (data: { roomId: string }) => {
      const { roomId } = data;
      
      const existingTimeout = typingTimeouts.get(socket.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        typingTimeouts.delete(socket.id);
      }

      this.stopTyping(socket, roomId);
    });

    // Clean up on disconnect
    socket.on(SocketEvent.DISCONNECT, () => {
      for (const [socketId, timeout] of typingTimeouts.entries()) {
        if (socketId === socket.id) {
          clearTimeout(timeout);
        }
      }
    });
  }

  private stopTyping(socket: Socket, roomId: string): void {
    const room = rooms.get(roomId);
    if (!room) return;

    const member = room.members.get(socket.id);
    if (member) {
      member.isTyping = false;
    }

    const user = socket.data.user as UserInfo;
    socket.to(roomId).emit(SocketEvent.USER_TYPING, {
      user,
      roomId,
      isTyping: false,
      timestamp: Date.now(),
    } as TypingEvent);
  }

  // ===========================================================================
  // Cursor Tracking
  // ===========================================================================

  private handleCursor(socket: Socket): void {
    if (!this.config.enableCursors) return;

    socket.on(SocketEvent.CURSOR_MOVE, (data: { 
      roomId: string; 
      position: CursorPosition;
    }) => {
      const { roomId, position } = data;
      const user = socket.data.user as UserInfo;

      if (this.isRateLimited(`${user.id}:cursor`, 'cursor')) {
        return;
      }

      const room = rooms.get(roomId);
      if (!room) return;

      const member = room.members.get(socket.id);
      if (member) {
        member.cursor = position;
        member.lastActivity = new Date();
      }

      // Broadcast cursor position (throttled per client)
      socket.to(roomId).emit(SocketEvent.CURSOR_UPDATE, {
        user,
        position,
        timestamp: Date.now(),
      });
    });
  }

  // ===========================================================================
  // Message Handling
  // ===========================================================================

  private handleMessage(socket: Socket): void {
    socket.on(SocketEvent.MESSAGE_SEND, async (data: {
      roomId: string;
      content: string;
      parentId?: string;
    }) => {
      const { roomId, content, parentId } = data;
      const user = socket.data.user as UserInfo;

      if (this.isRateLimited(`${user.id}:message`, 'message')) {
        socket.emit(SocketEvent.RATE_LIMITED, {
          event: SocketEvent.MESSAGE_SEND,
          retryAfter: this.getRateLimitReset(user.id),
        });
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit(SocketEvent.ERROR, {
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found',
        });
        return;
      }

      // Create message
      const message: RealtimeMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content,
        user,
        roomId,
        parentId,
        timestamp: Date.now(),
      };

      // Broadcast to room
      this.io.to(roomId).emit(SocketEvent.MESSAGE_RECEIVE, message);

      // Update member activity
      const member = room.members.get(socket.id);
      if (member) {
        member.lastActivity = new Date();
        member.isTyping = false;
      }
    });

    socket.on(SocketEvent.MESSAGE_EDIT, (data: {
      roomId: string;
      messageId: string;
      content: string;
    }) => {
      const { roomId, messageId, content } = data;
      
      this.io.to(roomId).emit(SocketEvent.MESSAGE_EDIT, {
        messageId,
        content,
        userId: socket.data.user?.id,
        timestamp: Date.now(),
      });
    });

    socket.on(SocketEvent.MESSAGE_DELETE, (data: {
      roomId: string;
      messageId: string;
    }) => {
      const { roomId, messageId } = data;
      
      this.io.to(roomId).emit(SocketEvent.MESSAGE_DELETE, {
        messageId,
        userId: socket.data.user?.id,
        timestamp: Date.now(),
      });
    });
  }

  // ===========================================================================
  // Disconnect Handler
  // ===========================================================================

  private handleDisconnect(socket: Socket): void {
    socket.on(SocketEvent.DISCONNECT, async (reason: string) => {
      console.log(`Socket disconnected: ${socket.id}, Reason: ${reason}`);

      const user = socket.data.user as UserInfo;

      // Leave all rooms
      for (const [roomId, room] of rooms.entries()) {
        if (room.members.has(socket.id)) {
          this.leaveRoom(socket, roomId);

          // Notify others
          socket.to(roomId).emit(SocketEvent.PRESENCE_LEAVE, {
            user,
            roomId,
            status: PresenceStatus.OFFLINE,
            timestamp: Date.now(),
          } as PresenceEvent);
        }
      }

      // Clean up rate limit data
      rateLimits.delete(socket.id);
      rateLimits.delete(user?.id);
    });
  }

  // ===========================================================================
  // Rate Limiting
  // ===========================================================================

  private isRateLimited(identifier: string, type: 'join' | 'typing' | 'cursor' | 'message' | 'default' = 'default'): boolean {
    const now = Date.now();
    const key = `${identifier}:${type}`;
    
    let state = rateLimits.get(key);
    if (!state) {
      state = {
        eventCount: 0,
        windowStart: now,
        isLimited: false,
      };
      rateLimits.set(key, state);
    }

    // Reset window if needed
    const windowMs = this.config.rateLimit.cooldownMs;
    if (now - state.windowStart > windowMs) {
      state.eventCount = 0;
      state.windowStart = now;
      state.isLimited = false;
      state.limitedUntil = undefined;
    }

    // Check if currently limited
    if (state.isLimited && state.limitedUntil && now < state.limitedUntil) {
      return true;
    }

    // Increment counter
    state.eventCount++;

    // Check limit
    const limit = type === 'typing' || type === 'cursor' 
      ? this.config.rateLimit.maxEventsPerSecond 
      : this.config.rateLimit.burstSize;

    if (state.eventCount > limit) {
      state.isLimited = true;
      state.limitedUntil = now + windowMs;
      return true;
    }

    return false;
  }

  private getRateLimitReset(identifier: string): number {
    const state = rateLimits.get(identifier);
    if (state?.limitedUntil) {
      return Math.ceil((state.limitedUntil - Date.now()) / 1000);
    }
    return 0;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  getIO(): SocketIOServer {
    return this.io;
  }

  getRooms(): Map<string, Room> {
    return rooms;
  }

  getRoom(roomId: string): Room | undefined {
    return rooms.get(roomId);
  }

  // Send notification to specific user
  notifyUser(userId: string, notification: NotificationEvent): void {
    for (const [_, room] of rooms) {
      for (const [socketId, member] of room.members) {
        if (member.user.id === userId) {
          this.io.to(socketId).emit(SocketEvent.NOTIFICATION, notification);
        }
      }
    }
  }

  // Broadcast to all members of a room
  broadcastToRoom(roomId: string, event: string, data: unknown): void {
    this.io.to(roomId).emit(event, data);
  }

  // Close all connections
  close(): void {
    this.io.close();
    rooms.clear();
    rateLimits.clear();
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let websocketServer: WebSocketServer | null = null;

export function initWebSocketServer(
  server: NetServer,
  config?: Partial<RealtimeServerConfig>
): WebSocketServer {
  if (!websocketServer) {
    websocketServer = new WebSocketServer(server, config);
  }
  return websocketServer;
}

export function getWebSocketServer(): WebSocketServer | null {
  return websocketServer;
}

export function getIO(): SocketIOServer | undefined {
  return globalThis.io;
}

// =============================================================================
// Helper Functions
// =============================================================================

export function getRoomMembers(roomId: string): RoomMember[] {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.members.values());
}

export function getOnlineUsersInRoom(roomId: string): UserInfo[] {
  return getRoomMembers(roomId).map(m => m.user);
}

export function isUserInRoom(roomId: string, userId: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  
  for (const member of room.members.values()) {
    if (member.user.id === userId) return true;
  }
  return false;
}
