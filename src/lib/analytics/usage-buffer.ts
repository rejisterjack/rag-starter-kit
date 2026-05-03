/**
 * Batch API Usage Writer
 *
 * Buffers API usage records in memory and flushes them to the database
 * periodically or when the buffer reaches capacity. This reduces database
 * write pressure under high chat volume.
 *
 * Usage:
 *   import { bufferUsageRecord, flushUsageBuffer } from './usage-buffer';
 *   bufferUsageRecord({ userId, endpoint, ... });
 *
 * The buffer auto-flushes every 10 seconds or when it reaches 50 records.
 * Call flushUsageBuffer() in graceful shutdown hooks if needed.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface UsageRecord {
  userId: string;
  workspaceId?: string | null;
  endpoint: string;
  method: string;
  tokensPrompt: number;
  tokensCompletion: number;
  tokensTotal: number;
  latencyMs: number;
}

const MAX_BUFFER_SIZE = 50;
const FLUSH_INTERVAL_MS = 10_000;

let buffer: UsageRecord[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function ensureTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flush().catch((err) => {
      logger.warn('Periodic usage buffer flush failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, FLUSH_INTERVAL_MS);
  // Allow the process to exit even if the timer is running
  if (flushTimer && typeof flushTimer === 'object' && 'unref' in flushTimer) {
    flushTimer.unref();
  }
}

export function bufferUsageRecord(record: UsageRecord): void {
  buffer.push(record);
  ensureTimer();

  if (buffer.length >= MAX_BUFFER_SIZE) {
    flush().catch((err) => {
      logger.warn('Usage buffer flush (capacity) failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }
}

export async function flushUsageBuffer(): Promise<void> {
  await flush();
}

async function flush(): Promise<void> {
  if (buffer.length === 0) return;

  // Swap buffer atomically
  const records = buffer;
  buffer = [];

  try {
    await prisma.apiUsage.createMany({ data: records });
    logger.debug('Flushed usage records', { count: records.length });
  } catch (err) {
    logger.warn('Failed to flush usage records, re-enqueuing', {
      count: records.length,
      error: err instanceof Error ? err.message : String(err),
    });
    // Re-enqueue failed records at the front (cap to prevent unbounded growth)
    buffer = [...records, ...buffer].slice(0, MAX_BUFFER_SIZE * 2);
  }
}
