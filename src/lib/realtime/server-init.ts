/**
 * WebSocket Server Initialization
 *
 * This module provides initialization logic for the WebSocket server
 * to be used in custom Next.js server setups or instrumentation hooks.
 *
 * Usage:
 * ```typescript
 * // In your custom server or instrumentation.ts
 * import { initRealtimeServer } from '@/lib/realtime/server-init';
 *
 * // With HTTP server
 * initRealtimeServer(httpServer);
 * ```
 */

import type { Server as NetServer } from 'node:http';

// WebSocketServer type is used implicitly via dynamic imports

// =============================================================================
// Initialization State
// =============================================================================

let isInitialized = false;
let ioInstance: ReturnType<import('./websocket-server').WebSocketServer['getIO']> | undefined;

// =============================================================================
// Server Initialization
// =============================================================================

/**
 * Initialize the real-time server with an HTTP server instance
 * This should be called once when your server starts
 */
export function initRealtimeServer(
  httpServer: NetServer,
  config?: Parameters<typeof import('./websocket-server').initWebSocketServer>[1]
): void {
  if (isInitialized) {
    return;
  }
  const { initWebSocketServer } = require('./websocket-server');

  const serverConfig = {
    corsOrigin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    enablePresence: true,
    enableCursors: true,
    enableTyping: true,
    ...config,
  };

  const server = initWebSocketServer(httpServer, serverConfig);
  ioInstance = server.getIO();
  isInitialized = true;
}

/**
 * Check if the real-time server is initialized
 */
export function isRealtimeServerInitialized(): boolean {
  return isInitialized;
}

/**
 * Get the Socket.io instance
 * Returns undefined if the server is not initialized
 */
export function getRealtimeIO():
  | ReturnType<import('./websocket-server').WebSocketServer['getIO']>
  | undefined {
  return ioInstance;
}

// =============================================================================
// Next.js Instrumentation Integration
// =============================================================================

/**
 * Register function for Next.js instrumentation
 * Use this in your instrumentation.ts for Next.js 13+ apps
 *
 * Note: WebSocket initialization requires an HTTP server instance,
 * which is not available during Next.js instrumentation.
 * For production, use a custom server or a separate WebSocket server.
 */
export async function registerRealtimeInstrumentation(): Promise<void> {
  // This is a placeholder for future Next.js instrumentation support
  // Currently, WebSocket requires a custom server setup

  if (process.env.NODE_ENV === 'development') {
  }
}

// =============================================================================
// Custom Server Setup Helper
// =============================================================================

/**
 * Setup helper for custom Next.js server
 *
 * Example usage in server.ts:
 * ```typescript
 * import { createServer } from 'http';
 * import next from 'next';
 * import { setupRealtimeServer } from '@/lib/realtime/server-init';
 *
 * const dev = process.env.NODE_ENV !== 'production';
 * const app = next({ dev });
 * const handle = app.getRequestHandler();
 *
 * app.prepare().then(() => {
 *   const server = createServer(handle);
 *   setupRealtimeServer(server);
 *
 *   server.listen(3000, () => {
 *     console.log('> Ready on http://localhost:3000');
 *   });
 * });
 * ```
 */
export function setupRealtimeServer(
  httpServer: NetServer,
  config?: Parameters<typeof import('./websocket-server').initWebSocketServer>[1]
): void {
  // Only initialize in Node.js runtime
  if (typeof window !== 'undefined') {
    return;
  }

  initRealtimeServer(httpServer, config);
}

// =============================================================================
// Graceful Shutdown with Request Draining
// =============================================================================

let activeRequests = 0;
let shutdownInProgress = false;

/**
 * Track an active request for graceful shutdown
 */
export function trackRequest<T>(promise: Promise<T>): Promise<T> {
  if (shutdownInProgress) {
    return Promise.reject(new Error('Server is shutting down'));
  }

  activeRequests++;
  return promise.finally(() => {
    activeRequests--;
  });
}

/**
 * Gracefully shutdown the real-time server
 * Waits for in-flight requests to complete before shutting down
 */
export function shutdownRealtimeServer(maxWaitMs = 30000): Promise<void> {
  return new Promise((resolve) => {
    if (!ioInstance) {
      resolve();
      return;
    }

    shutdownInProgress = true;

    // Set a maximum wait time
    const forceShutdownTimeout = setTimeout(() => {
      forceShutdown();
    }, maxWaitMs);

    const forceShutdown = () => {
      clearTimeout(forceShutdownTimeout);

      // Disconnect all sockets forcefully
      ioInstance?.disconnectSockets(true);

      // Close the server
      ioInstance?.close(() => {
        isInitialized = false;
        ioInstance = undefined;
        shutdownInProgress = false;
        resolve();
      });
    };

    // Check if all requests are done
    const checkRequests = () => {
      if (activeRequests === 0) {
        clearTimeout(forceShutdownTimeout);
        forceShutdown();
      } else {
        // Check again in 100ms
        setTimeout(checkRequests, 100);
      }
    };

    // Start checking
    checkRequests();
  });
}

// Handle graceful shutdown on process exit
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    shutdownRealtimeServer()
      .then(() => {
        process.exit(0);
      })
      .catch(() => {
        process.exit(1);
      });
  });

  process.on('SIGINT', () => {
    shutdownRealtimeServer()
      .then(() => {
        process.exit(0);
      })
      .catch(() => {
        process.exit(1);
      });
  });
}
