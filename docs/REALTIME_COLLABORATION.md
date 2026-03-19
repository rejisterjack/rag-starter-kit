# Real-Time Collaboration

This document describes the real-time collaboration features in the RAG Starter Kit, including WebSocket and Server-Sent Events (SSE) support for live updates, typing indicators, presence tracking, and collaborative cursors.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Client Usage](#client-usage)
- [Server Configuration](#server-configuration)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)

## Overview

The real-time collaboration system provides:

- **WebSocket Communication**: Full-duplex communication for real-time updates
- **SSE Fallback**: Server-Sent Events for environments that block WebSockets
- **Room Management**: Join/leave rooms for workspaces and conversations
- **Typing Indicators**: See when other users are typing
- **Presence Tracking**: Know who's online and viewing the same content
- **Collaborative Cursors**: (Optional) See other users' cursor positions
- **Rate Limiting**: Prevent abuse of real-time features
- **Authentication**: Secure connections with JWT/session validation

## Features

### 1. WebSocket Server (`/src/lib/realtime/websocket-server.ts`)

Socket.io server with:
- Room management (per workspace, per conversation)
- Event handlers for join, leave, typing, cursor, message
- Authentication middleware
- Rate limiting per socket and per event type

### 2. Realtime Service (`/src/lib/realtime/realtime-service.ts`)

Client-side service for managing connections:
- WebSocket connection management
- SSE fallback support
- Presence tracking
- Reconnection logic
- Event handling

### 3. React Hooks (`/src/hooks/use-realtime.ts`)

- `useRealtime`: Main hook for WebSocket connection
- `useTypingIndicator`: Manage typing state
- `usePresence`: Track online users
- `useCursorSync`: Collaborative cursor positions

### 4. UI Components (`/src/components/realtime/`)

- `TypingIndicator`: Shows "User is typing..." with animated dots
- `PresenceIndicator`: Online/offline status with avatar group
- `CollaborativeCursors`: Live cursor positions
- `LiveChatIndicator`: Shows connection status and viewers

### 5. SSE Fallback (`/src/app/api/realtime/events/route.ts`)

Server-Sent Events endpoint for:
- Clients behind corporate proxies
- Mobile devices with WebSocket issues
- Graceful degradation

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Side                          │
├─────────────────────────────────────────────────────────────┤
│  React Hooks (useRealtime, useTypingIndicator, etc.)        │
│  ├─ RealtimeService (WebSocket/SSE client)                  │
│  └─ UI Components (TypingIndicator, PresenceIndicator)      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Next.js API Routes                      │
├─────────────────────────────────────────────────────────────┤
│  /api/socket      - Socket.io configuration                 │
│  /api/realtime/events - SSE endpoint                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Server Side                            │
├─────────────────────────────────────────────────────────────┤
│  WebSocketServer - Socket.io server with room management    │
│  ├─ Authentication middleware                               │
│  ├─ Rate limiting                                           │
│  └─ Event handlers                                          │
└─────────────────────────────────────────────────────────────┘
```

## Getting Started

### 1. Install Dependencies

Dependencies are already installed via `pnpm add socket.io socket.io-client`.

### 2. Environment Variables

Add to your `.env.local`:

```bash
# Application URL (used for CORS)
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Optional: WebSocket server port for standalone mode
# WS_PORT=3001
# WS_HOST=0.0.0.0

# Optional: Internal secret for SSE broadcasts
# INTERNAL_SECRET="your-internal-secret"
```

### 3. Start the Development Server

For full WebSocket support, use the custom server:

```bash
# Development with WebSocket support
pnpm dev:ws

# Or run standalone WebSocket server
pnpm ws:server
```

For standard Next.js dev (WebSocket features won't work):

```bash
pnpm dev
```

### 4. Production Deployment

```bash
# Build
pnpm build

# Start with WebSocket support
pnpm start:ws

# Or start standalone WebSocket server
pnpm ws:server
```

## Client Usage

### Basic Connection

```tsx
'use client';

import { useRealtime } from '@/hooks/use-realtime';

function ChatRoom({ conversationId }: { conversationId: string }) {
  const {
    isConnected,
    isConnecting,
    error,
    onlineUsers,
    joinRoom,
    leaveRoom,
    sendMessage,
  } = useRealtime({
    roomId: conversationId,
    roomType: 'conversation',
    autoConnect: true,
    onMessage: (message) => {
      console.log('New message:', message);
    },
    onError: (error) => {
      console.error('Connection error:', error);
    },
  });

  // Component renders...
}
```

### Typing Indicator

```tsx
import { useTypingIndicator } from '@/hooks/use-realtime';
import { TypingIndicator } from '@/components/realtime';

function ChatInput({ roomId, service }) {
  const { isTyping, typingUsers, startTyping, stopTyping } = useTypingIndicator(
    service,
    { roomId, delay: 5000 }
  );

  const handleInputChange = (e) => {
    startTyping();
    // ... handle input
  };

  return (
    <div>
      <TypingIndicator typingUsers={typingUsers} />
      <input onChange={handleInputChange} onBlur={stopTyping} />
    </div>
  );
}
```

### Presence Tracking

```tsx
import { usePresence } from '@/hooks/use-realtime';
import { PresenceIndicator } from '@/components/realtime';

function ChatHeader({ roomId, service }) {
  const { onlineUsers, onlineCount } = usePresence(service, { roomId });

  return (
    <PresenceIndicator
      users={onlineUsers}
      maxDisplay={4}
      showTooltip
    />
  );
}
```

### Collaborative Cursors (Optional)

```tsx
import { useCursorSync } from '@/hooks/use-realtime';
import { CollaborativeCursors } from '@/components/realtime';

function CollaborativeEditor({ roomId }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { cursors, updateCursor } = useCursorSync(service, {
    roomId,
    containerRef,
  });

  return (
    <div ref={containerRef} className="relative">
      <CollaborativeCursors cursors={cursors} />
      {/* Editor content */}
    </div>
  );
}
```

### Live Chat Status

```tsx
import { LiveChatIndicator } from '@/components/realtime';

function ChatStatus({ users, isConnected }) {
  return (
    <LiveChatIndicator
      users={users}
      isConnected={isConnected}
      isSyncing={false}
      lastSyncAt={new Date()}
      pendingMessages={0}
    />
  );
}
```

## Server Configuration

### Custom Server Setup

Create a custom server with WebSocket support:

```typescript
// server.ts
import { createServer } from 'http';
import next from 'next';
import { setupRealtimeServer } from '@/lib/realtime/server-init';

const app = next({ dev: process.env.NODE_ENV !== 'production' });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  // Initialize WebSocket server
  setupRealtimeServer(server, {
    corsOrigin: process.env.NEXT_PUBLIC_APP_URL,
    enablePresence: true,
    enableCursors: true,
    enableTyping: true,
  });

  server.listen(3000);
});
```

### Standalone WebSocket Server

For production deployments, run WebSocket server separately:

```bash
# Terminal 1: Next.js app
pnpm start

# Terminal 2: WebSocket server
pnpm ws:server
```

### Rate Limiting

Configure rate limits in `websocket-server.ts`:

```typescript
const config = {
  rateLimit: {
    maxEventsPerSecond: 10,
    burstSize: 20,
    cooldownMs: 1000,
  },
};
```

## API Reference

### Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `connect` | Client → Server | Client connects |
| `disconnect` | Client → Server | Client disconnects |
| `join_room` | Client → Server | Join a room |
| `leave_room` | Client → Server | Leave a room |
| `typing_start` | Client → Server | User started typing |
| `typing_stop` | Client → Server | User stopped typing |
| `cursor_move` | Client → Server | Cursor position update |
| `message_send` | Client → Server | Send a message |
| `room_joined` | Server → Client | Successfully joined room |
| `user_typing` | Server → Client | Another user is typing |
| `cursor_update` | Server → Client | Cursor position update |
| `message_receive` | Server → Client | New message received |
| `presence_join` | Server → Client | User came online |
| `presence_leave` | Server → Client | User went offline |

### SSE Event Types

| Type | Description |
|------|-------------|
| `message` | New message |
| `typing` | Typing indicator update |
| `presence` | Presence update |
| `cursor` | Cursor position (if enabled) |
| `notification` | User notification |
| `ping` | Keep-alive ping |

### Hooks

#### `useRealtime`

```typescript
interface UseRealtimeOptions {
  roomId?: string;
  roomType?: 'workspace' | 'conversation' | 'private';
  autoConnect?: boolean;
  onMessage?: (message: RealtimeMessage) => void;
  onTyping?: (event: TypingEvent) => void;
  onPresence?: (event: PresenceEvent) => void;
  onCursor?: (event: CursorUpdate) => void;
  onNotification?: (notification: NotificationEvent) => void;
  onError?: (error: Error) => void;
  config?: Partial<RealtimeClientConfig>;
}

interface UseRealtimeReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  reconnectAttempts: number;
  currentRoomId: string | null;
  onlineUsers: RoomMember[];
  connect: () => Promise<void>;
  disconnect: () => void;
  joinRoom: (roomId: string, type?: RoomType) => Promise<void>;
  leaveRoom: (roomId: string) => void;
  sendMessage: (content: string, parentId?: string) => void;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
}
```

#### `useTypingIndicator`

```typescript
interface UseTypingIndicatorReturn {
  isTyping: boolean;
  typingUsers: TypingEvent[];
  startTyping: () => void;
  stopTyping: () => void;
}
```

#### `usePresence`

```typescript
interface UsePresenceReturn {
  onlineUsers: RoomMember[];
  onlineCount: number;
  isUserOnline: (userId: string) => boolean;
}
```

#### `useCursorSync`

```typescript
interface UseCursorSyncReturn {
  cursors: Map<string, CursorState>;
  updateCursor: (position: CursorPosition) => void;
}
```

## Troubleshooting

### WebSocket Connection Fails

1. **Check CORS settings**: Ensure `NEXT_PUBLIC_APP_URL` is set correctly
2. **Firewall/Proxy**: Some corporate networks block WebSockets
   - Solution: SSE fallback is automatic
3. **Custom Server**: Use `pnpm dev:ws` instead of `pnpm dev`

### SSE Connection Issues

1. **Rate Limiting**: Check if you're hitting SSE connection limits
2. **Browser Support**: SSE requires modern browsers
3. **Connection Limits**: Browsers limit concurrent connections per domain

### Type Errors

1. **Regenerate types**: `pnpm db:generate`
2. **Restart TypeScript**: Reload VS Code or restart `tsc --watch`

### Performance Issues

1. **Cursor Throttling**: Cursor updates are throttled to 20/sec
2. **Room Size**: Max 50 clients per room by default
3. **Reconnection**: Exponential backoff for reconnection attempts

## Security Considerations

1. **Authentication**: All connections require valid session/token
2. **Rate Limiting**: Configurable limits per event type
3. **Room Access**: Implement room-level permissions as needed
4. **Input Validation**: Sanitize all user inputs before broadcasting
5. **CORS**: Configure allowed origins in production

## Contributing

When adding new real-time features:

1. Add event types to `src/lib/realtime/types.ts`
2. Implement server handlers in `websocket-server.ts`
3. Add client methods in `realtime-service.ts`
4. Create React hooks if needed
5. Build UI components
6. Add SSE support for critical features
7. Update this documentation
