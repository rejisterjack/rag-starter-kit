/**
 * Custom Next.js Server with WebSocket Support
 *
 * This server combines Next.js HTTP handling with WebSocket support
 * for full real-time collaboration features.
 *
 * Usage:
 * ```bash
 * # Development
 * tsx server.ts
 *
 * # Production
 * NODE_ENV=production tsx server.ts
 * ```
 */

import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { initRealtimeServer, shutdownRealtimeServer } from '@/lib/realtime/server-init';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

async function main() {
  console.log(`Starting ${dev ? 'development' : 'production'} server...`);

  // Initialize Next.js
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const url = req.url || '/';
      const parsedUrl = parse(url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Initialize WebSocket server
  initRealtimeServer(server, {
    corsOrigin: process.env.NEXT_PUBLIC_APP_URL || `http://${hostname}:${port}`,
    enablePresence: true,
    enableCursors: true,
    enableTyping: true,
  });

  // Start the server
  server.listen(port, hostname, () => {
    console.log(`✓ Ready on http://${hostname}:${port}`);
    console.log(`✓ WebSocket ready on ws://${hostname}:${port}`);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);

    await shutdownRealtimeServer();

    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
