/**
 * Standalone WebSocket Server Script
 *
 * This script can be used to run a standalone WebSocket server
 * for production deployments where WebSocket and HTTP are separate.
 *
 * Usage:
 * ```bash
 * tsx scripts/websocket-server.ts
 * ```
 */

import { createServer } from 'node:http';
import { initRealtimeServer, shutdownRealtimeServer } from '@/lib/realtime/server-init';

const PORT = parseInt(process.env.WS_PORT || '3001', 10);
const HOST = process.env.WS_HOST || '0.0.0.0';

async function main(): Promise<void> {
  console.log('Starting WebSocket server...');

  // Create a simple HTTP server (for health checks)
  const httpServer = createServer((req, res): void => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'healthy',
          service: 'websocket',
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  // Initialize the real-time server
  initRealtimeServer(httpServer, {
    corsOrigin: process.env.NEXT_PUBLIC_APP_URL || '*',
    enablePresence: true,
    enableCursors: true,
    enableTyping: true,
  });

  // Start the server
  httpServer.listen(PORT, HOST, () => {
    console.log(`✓ WebSocket server listening on ws://${HOST}:${PORT}`);
    console.log(`  Health check: http://${HOST}:${PORT}/health`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down...');
    await shutdownRealtimeServer();
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down...');
    await shutdownRealtimeServer();
    httpServer.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error('Failed to start WebSocket server:', error);
  process.exit(1);
});
