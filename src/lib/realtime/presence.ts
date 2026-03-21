/**
 * Presence Tracking System using Redis/Upstash
 * Tracks user online status, current view, typing indicators, and cursor positions
 */

import { Redis } from '@upstash/redis';
import type { CursorPosition, PresenceStatus, UserInfo } from './types';

// =============================================================================
// Redis Client Configuration
// =============================================================================

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        'Redis configuration missing. Set either UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (for Upstash) or REDIS_URL (for local Redis).'
      );
    }

    redis = new Redis({
      url,
      token,
    });
  }
  return redis;
}

// Check if Redis is configured (supports Upstash or local Redis)
export function isRedisConfigured(): boolean {
  return !!(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    process.env.REDIS_URL
  );
}

// =============================================================================
// Types
// =============================================================================

export interface PresenceData {
  user: UserInfo;
  status: PresenceStatus;
  currentView?: {
    type: 'workspace' | 'conversation' | 'document';
    id: string;
  };
  isTyping?: boolean;
  typingIn?: string;
  cursor?: CursorPosition;
  lastSeen: number;
  connectedAt: number;
}

export interface PresenceUpdate {
  userId: string;
  status?: PresenceStatus;
  currentView?: {
    type: 'workspace' | 'conversation' | 'document';
    id: string;
  };
  isTyping?: boolean;
  typingIn?: string;
  cursor?: CursorPosition;
}

export interface TypingState {
  userId: string;
  user: UserInfo;
  startedAt: number;
  roomId: string;
}

export interface CursorState {
  userId: string;
  user: UserInfo;
  position: CursorPosition;
  timestamp: number;
}

// =============================================================================
// Key Generators
// =============================================================================

const KEY_PREFIX = 'presence:';

function getPresenceKey(userId: string): string {
  return `${KEY_PREFIX}user:${userId}`;
}

function getRoomKey(roomType: string, roomId: string): string {
  return `${KEY_PREFIX}room:${roomType}:${roomId}`;
}

function getTypingKey(roomId: string): string {
  return `${KEY_PREFIX}typing:${roomId}`;
}

function getCursorKey(roomId: string): string {
  return `${KEY_PREFIX}cursor:${roomId}`;
}

function getUserRoomsKey(userId: string): string {
  return `${KEY_PREFIX}user:${userId}:rooms`;
}

// =============================================================================
// Presence Management
// =============================================================================

const PRESENCE_TTL_SECONDS = 60; // 1 minute TTL for presence
const TYPING_TTL_SECONDS = 6; // 6 seconds TTL for typing
const CURSOR_TTL_SECONDS = 30; // 30 seconds TTL for cursor

/**
 * Update user presence in Redis
 */
export async function updatePresence(
  userId: string,
  data: Omit<PresenceData, 'lastSeen' | 'connectedAt'>
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  const redis = getRedisClient();
  const key = getPresenceKey(userId);
  const now = Date.now();

  const presenceData: PresenceData = {
    ...data,
    lastSeen: now,
    connectedAt: now,
  };

  // Update user presence with TTL
  await redis.setex(key, PRESENCE_TTL_SECONDS, JSON.stringify(presenceData));

  // Add user to room if viewing something
  if (data.currentView) {
    const roomKey = getRoomKey(data.currentView.type, data.currentView.id);
    await redis.sadd(roomKey, userId);
    await redis.expire(roomKey, PRESENCE_TTL_SECONDS);

    // Track user's rooms for cleanup
    const userRoomsKey = getUserRoomsKey(userId);
    await redis.sadd(userRoomsKey, `${data.currentView.type}:${data.currentView.id}`);
    await redis.expire(userRoomsKey, PRESENCE_TTL_SECONDS);
  }
}

/**
 * Heartbeat to keep presence alive
 */
export async function heartbeat(userId: string): Promise<void> {
  if (!isRedisConfigured()) return;

  const redis = getRedisClient();
  const key = getPresenceKey(userId);

  const existing = await redis.get<string>(key);
  if (existing) {
    try {
      const data: PresenceData = JSON.parse(existing);
      data.lastSeen = Date.now();
      await redis.setex(key, PRESENCE_TTL_SECONDS, JSON.stringify(data));

      // Extend room memberships
      if (data.currentView) {
        const roomKey = getRoomKey(data.currentView.type, data.currentView.id);
        await redis.expire(roomKey, PRESENCE_TTL_SECONDS);
      }
    } catch {
      // Invalid data, will be cleaned up by TTL
    }
  }
}

/**
 * Get presence data for a specific user
 */
export async function getUserPresence(userId: string): Promise<PresenceData | null> {
  if (!isRedisConfigured()) return null;

  const redis = getRedisClient();
  const key = getPresenceKey(userId);

  const data = await redis.get<string>(key);
  if (!data) return null;

  try {
    return JSON.parse(data) as PresenceData;
  } catch {
    return null;
  }
}

/**
 * Get all users in a room
 */
export async function getUsersInRoom(roomType: string, roomId: string): Promise<PresenceData[]> {
  if (!isRedisConfigured()) return [];

  const redis = getRedisClient();
  const roomKey = getRoomKey(roomType, roomId);

  const userIds = await redis.smembers(roomKey);
  if (!userIds || userIds.length === 0) return [];

  const presences: PresenceData[] = [];

  for (const userId of userIds) {
    const presence = await getUserPresence(userId);
    if (presence && presence.status !== 'offline') {
      presences.push(presence);
    }
  }

  return presences;
}

/**
 * Remove user presence
 */
export async function removePresence(userId: string): Promise<void> {
  if (!isRedisConfigured()) return;

  const redis = getRedisClient();

  // Get current presence to clean up room memberships
  const presence = await getUserPresence(userId);
  if (presence?.currentView) {
    const roomKey = getRoomKey(presence.currentView.type, presence.currentView.id);
    await redis.srem(roomKey, userId);
  }

  // Get all rooms this user is in
  const userRoomsKey = getUserRoomsKey(userId);
  const rooms = await redis.smembers(userRoomsKey);

  // Remove from all rooms
  for (const room of rooms || []) {
    const [type, id] = room.split(':');
    if (type && id) {
      const roomKey = getRoomKey(type, id);
      await redis.srem(roomKey, userId);
    }
  }

  // Delete presence and rooms tracking
  await redis.del(getPresenceKey(userId));
  await redis.del(userRoomsKey);

  // Clean up typing and cursor data
  await redis.del(getTypingKey(userId));
}

/**
 * Set user status
 */
export async function setUserStatus(userId: string, status: PresenceStatus): Promise<void> {
  if (!isRedisConfigured()) return;

  const redis = getRedisClient();
  const key = getPresenceKey(userId);

  const existing = await redis.get<string>(key);
  if (existing) {
    try {
      const data: PresenceData = JSON.parse(existing);
      data.status = status;
      data.lastSeen = Date.now();
      await redis.setex(key, PRESENCE_TTL_SECONDS, JSON.stringify(data));
    } catch {
      // Invalid data
    }
  }
}

/**
 * Update user's current view
 */
export async function setCurrentView(
  userId: string,
  view: { type: 'workspace' | 'conversation' | 'document'; id: string } | null
): Promise<void> {
  if (!isRedisConfigured()) return;

  const redis = getRedisClient();

  // Get current presence
  const presence = await getUserPresence(userId);
  if (!presence) return;

  // Remove from old room if exists
  if (presence.currentView) {
    const oldRoomKey = getRoomKey(presence.currentView.type, presence.currentView.id);
    await redis.srem(oldRoomKey, userId);
  }

  // Update presence
  const key = getPresenceKey(userId);
  presence.currentView = view || undefined;
  presence.lastSeen = Date.now();
  await redis.setex(key, PRESENCE_TTL_SECONDS, JSON.stringify(presence));

  // Add to new room if provided
  if (view) {
    const roomKey = getRoomKey(view.type, view.id);
    await redis.sadd(roomKey, userId);
    await redis.expire(roomKey, PRESENCE_TTL_SECONDS);

    const userRoomsKey = getUserRoomsKey(userId);
    await redis.sadd(userRoomsKey, `${view.type}:${view.id}`);
    await redis.expire(userRoomsKey, PRESENCE_TTL_SECONDS);
  }
}

// =============================================================================
// Typing Indicators
// =============================================================================

/**
 * Set typing status for a user
 */
export async function setTyping(
  userId: string,
  roomId: string,
  isTyping: boolean,
  user?: UserInfo
): Promise<void> {
  if (!isRedisConfigured()) return;

  const redis = getRedisClient();
  const key = getTypingKey(roomId);

  if (isTyping && user) {
    const typingData: TypingState = {
      userId,
      user,
      startedAt: Date.now(),
      roomId,
    };
    await redis.hset(key, { [userId]: JSON.stringify(typingData) });
    await redis.expire(key, TYPING_TTL_SECONDS);
  } else {
    await redis.hdel(key, userId);
  }

  // Update presence typing state
  const presence = await getUserPresence(userId);
  if (presence) {
    presence.isTyping = isTyping;
    presence.typingIn = isTyping ? roomId : undefined;
    presence.lastSeen = Date.now();
    await redis.setex(getPresenceKey(userId), PRESENCE_TTL_SECONDS, JSON.stringify(presence));
  }
}

/**
 * Get all typing users in a room
 */
export async function getTypingUsers(roomId: string): Promise<TypingState[]> {
  if (!isRedisConfigured()) return [];

  const redis = getRedisClient();
  const key = getTypingKey(roomId);

  const data = await redis.hgetall<Record<string, string>>(key);
  if (!data) return [];

  const now = Date.now();
  const users: TypingState[] = [];

  for (const [, value] of Object.entries(data)) {
    try {
      const typingState: TypingState = JSON.parse(value);
      // Only include if within typing window
      if (now - typingState.startedAt < TYPING_TTL_SECONDS * 1000) {
        users.push(typingState);
      }
    } catch {
      // Invalid data, skip
    }
  }

  return users;
}

// =============================================================================
// Cursor Tracking
// =============================================================================

/**
 * Update cursor position
 */
export async function updateCursor(
  userId: string,
  roomId: string,
  position: CursorPosition,
  user?: UserInfo
): Promise<void> {
  if (!isRedisConfigured()) return;

  const redis = getRedisClient();
  const key = getCursorKey(roomId);

  const cursorData: CursorState = {
    userId,
    user: user ?? { id: userId, name: 'Unknown', email: '' },
    position,
    timestamp: Date.now(),
  };

  await redis.hset(key, { [userId]: JSON.stringify(cursorData) });
  await redis.expire(key, CURSOR_TTL_SECONDS);

  // Update presence cursor
  const presence = await getUserPresence(userId);
  if (presence) {
    presence.cursor = position;
    presence.lastSeen = Date.now();
    await redis.setex(getPresenceKey(userId), PRESENCE_TTL_SECONDS, JSON.stringify(presence));
  }
}

/**
 * Get all cursor positions in a room
 */
export async function getCursorsInRoom(roomId: string): Promise<CursorState[]> {
  if (!isRedisConfigured()) return [];

  const redis = getRedisClient();
  const key = getCursorKey(roomId);

  const data = await redis.hgetall<Record<string, string>>(key);
  if (!data) return [];

  const now = Date.now();
  const cursors: CursorState[] = [];

  for (const [, value] of Object.entries(data)) {
    try {
      const cursorState: CursorState = JSON.parse(value);
      // Only include if within cursor window
      if (now - cursorState.timestamp < CURSOR_TTL_SECONDS * 1000) {
        cursors.push(cursorState);
      }
    } catch {
      // Invalid data, skip
    }
  }

  return cursors;
}

/**
 * Remove cursor for a user
 */
export async function removeCursor(userId: string, roomId: string): Promise<void> {
  if (!isRedisConfigured()) return;

  const redis = getRedisClient();
  const key = getCursorKey(roomId);
  await redis.hdel(key, userId);
}

// =============================================================================
// Cleanup Functions
// =============================================================================

/**
 * Clean up stale presence data
 * Should be called periodically or via a scheduled job
 */
export async function cleanupStalePresence(): Promise<{
  cleanedUsers: number;
  cleanedRooms: number;
}> {
  if (!isRedisConfigured()) return { cleanedUsers: 0, cleanedRooms: 0 };

  const redis = getRedisClient();
  let cleanedUsers = 0;
  let cleanedRooms = 0;

  // Scan for presence keys
  let cursor: string | number = '0';
  do {
    const result: [string, string[]] = await redis.scan(cursor, {
      match: `${KEY_PREFIX}user:*`,
      count: 100,
    });
    cursor = result[0];
    const keys = result[1];

    for (const key of keys) {
      // Check if key exists (TTL expired)
      const exists = await redis.exists(key);
      if (!exists) {
        // Extract userId from key
        const userId = key.replace(`${KEY_PREFIX}user:`, '');
        if (!userId.includes(':')) {
          // This is a user presence key, not a room tracking key
          cleanedUsers++;

          // Clean up room memberships
          const userRoomsKey = getUserRoomsKey(userId);
          const rooms = await redis.smembers(userRoomsKey);
          for (const room of rooms || []) {
            const [type, id] = room.split(':');
            if (type && id) {
              const roomKey = getRoomKey(type, id);
              await redis.srem(roomKey, userId);
              cleanedRooms++;
            }
          }
          await redis.del(userRoomsKey);
        }
      }
    }
  } while (cursor !== '0');

  return { cleanedUsers, cleanedRooms };
}

// =============================================================================
// Stats
// =============================================================================

/**
 * Get presence statistics
 */
export async function getPresenceStats(): Promise<{
  totalOnline: number;
  typingUsers: number;
  activeCursors: number;
}> {
  if (!isRedisConfigured()) {
    return { totalOnline: 0, typingUsers: 0, activeCursors: 0 };
  }

  const redis = getRedisClient();

  // Count online users
  let totalOnline = 0;
  let cursor: string | number = '0';
  do {
    const result: [string, string[]] = await redis.scan(cursor, {
      match: `${KEY_PREFIX}user:*`,
      count: 100,
    });
    cursor = result[0];
    const keys = result[1];

    for (const key of keys) {
      if (!key.includes(':rooms')) {
        totalOnline++;
      }
    }
  } while (cursor !== '0');

  // Count typing users (across all rooms)
  let typingUsers = 0;
  cursor = '0';
  do {
    const result: [string, string[]] = await redis.scan(cursor, {
      match: `${KEY_PREFIX}typing:*`,
      count: 100,
    });
    cursor = result[0];
    const keys = result[1];

    for (const key of keys) {
      const count = await redis.hlen(key);
      typingUsers += count;
    }
  } while (cursor !== '0');

  // Count active cursors (across all rooms)
  let activeCursors = 0;
  cursor = '0';
  do {
    const result: [string, string[]] = await redis.scan(cursor, {
      match: `${KEY_PREFIX}cursor:*`,
      count: 100,
    });
    cursor = result[0];
    const keys = result[1];

    for (const key of keys) {
      const count = await redis.hlen(key);
      activeCursors += count;
    }
  } while (cursor !== '0');

  return { totalOnline, typingUsers, activeCursors };
}
