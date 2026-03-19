/**
 * Real-time collaboration types
 * Defines all events, data structures, and types for WebSocket/SSE communication
 */

// Real-time collaboration types - no external imports needed at top level

// =============================================================================
// Socket Events
// =============================================================================

export enum SocketEvent {
  // Connection events
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  CONNECT_ERROR = 'connect_error',
  
  // Room events
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  ROOM_JOINED = 'room_joined',
  ROOM_LEFT = 'room_left',
  
  // Typing events
  TYPING_START = 'typing_start',
  TYPING_STOP = 'typing_stop',
  USER_TYPING = 'user_typing',
  
  // Cursor events
  CURSOR_MOVE = 'cursor_move',
  CURSOR_UPDATE = 'cursor_update',
  
  // Message events
  MESSAGE_SEND = 'message_send',
  MESSAGE_RECEIVE = 'message_receive',
  MESSAGE_EDIT = 'message_edit',
  MESSAGE_DELETE = 'message_delete',
  
  // Presence events
  PRESENCE_JOIN = 'presence_join',
  PRESENCE_LEAVE = 'presence_leave',
  PRESENCE_UPDATE = 'presence_update',
  
  // Notification events
  NOTIFICATION = 'notification',
  NOTIFY_USER = 'notify_user',
  
  // Error events
  ERROR = 'error',
  RATE_LIMITED = 'rate_limited',
}

// =============================================================================
// Room Types
// =============================================================================

export interface Room {
  id: string;
  type: RoomType;
  workspaceId?: string;
  conversationId?: string;
  members: Map<string, RoomMember>;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export enum RoomType {
  WORKSPACE = 'workspace',
  CONVERSATION = 'conversation',
  PRIVATE = 'private',
}

export interface RoomMember {
  socketId: string;
  user: UserInfo;
  joinedAt: Date;
  isTyping: boolean;
  lastActivity: Date;
  cursor?: CursorPosition;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role?: string;
}

// =============================================================================
// Cursor Types
// =============================================================================

export interface CursorPosition {
  x: number;
  y: number;
  elementId?: string;
  selection?: TextSelection;
}

export interface TextSelection {
  start: number;
  end: number;
  text: string;
}

export interface CursorUpdate {
  user: UserInfo;
  position: CursorPosition;
  timestamp: number;
}

// =============================================================================
// Typing Types
// =============================================================================

export interface TypingEvent {
  user: UserInfo;
  roomId: string;
  isTyping: boolean;
  timestamp: number;
}

export interface TypingIndicator {
  user: UserInfo;
  startedAt: Date;
}

// =============================================================================
// Message Types
// =============================================================================

export interface RealtimeMessage {
  id: string;
  content: string;
  user: UserInfo;
  roomId: string;
  parentId?: string;
  timestamp: number;
  edited?: boolean;
  editedAt?: number;
}

export interface MessageEditEvent {
  messageId: string;
  content: string;
  userId: string;
  timestamp: number;
}

export interface MessageDeleteEvent {
  messageId: string;
  userId: string;
  timestamp: number;
}

// =============================================================================
// Presence Types
// =============================================================================

export interface PresenceEvent {
  user: UserInfo;
  roomId: string;
  status: PresenceStatus;
  timestamp: number;
}

export enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  OFFLINE = 'offline',
}

export interface PresenceState {
  users: Map<string, RoomMember>;
  lastUpdated: Date;
}

// =============================================================================
// Notification Types
// =============================================================================

export interface NotificationEvent {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
  userId: string;
  timestamp: number;
  read?: boolean;
}

export enum NotificationType {
  MESSAGE = 'message',
  MENTION = 'mention',
  INVITATION = 'invitation',
  SYSTEM = 'system',
}

// =============================================================================
// Connection Types
// =============================================================================

export interface ConnectionOptions {
  userId: string;
  workspaceId?: string;
  conversationId?: string;
  authToken?: string;
}

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  reconnectAttempts: number;
}

// =============================================================================
// Rate Limit Types
// =============================================================================

export interface RateLimitConfig {
  maxEventsPerSecond: number;
  burstSize: number;
  cooldownMs: number;
}

export interface RateLimitState {
  eventCount: number;
  windowStart: number;
  isLimited: boolean;
  limitedUntil?: number;
}

// =============================================================================
// SSE Types
// =============================================================================

export interface SSEEvent {
  event: SSEEventType | string;
  data: Record<string, unknown>;
  id?: string;
  retry?: number;
}

export enum SSEEventType {
  MESSAGE = 'message',
  TYPING = 'typing',
  PRESENCE = 'presence',
  CURSOR = 'cursor',
  NOTIFICATION = 'notification',
  PING = 'ping',
}

// =============================================================================
// Client Configuration
// =============================================================================

export interface RealtimeClientConfig {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  timeout?: number;
  transports?: ('websocket' | 'polling')[];
  fallbackToSSE?: boolean;
}

export const DEFAULT_REALTIME_CONFIG: RealtimeClientConfig = {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ['websocket', 'polling'],
  fallbackToSSE: true,
};

// =============================================================================
// Server Configuration
// =============================================================================

export interface RealtimeServerConfig {
  corsOrigin: string | string[];
  pingTimeout: number;
  pingInterval: number;
  maxClientsPerRoom: number;
  rateLimit: RateLimitConfig;
  enablePresence: boolean;
  enableCursors: boolean;
  enableTyping: boolean;
}

export const DEFAULT_SERVER_CONFIG: RealtimeServerConfig = {
  corsOrigin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  pingTimeout: 60000,
  pingInterval: 25000,
  maxClientsPerRoom: 50,
  rateLimit: {
    maxEventsPerSecond: 10,
    burstSize: 20,
    cooldownMs: 1000,
  },
  enablePresence: true,
  enableCursors: true,
  enableTyping: true,
};
