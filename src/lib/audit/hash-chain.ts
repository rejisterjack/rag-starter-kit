/**
 * Audit Log Hash Chain
 *
 * Creates a blockchain-like integrity chain across audit log records.
 * Each record stores a SHA-256 hash of its content plus the previous
 * record's hash, making tampering detectable.
 */

import { createHash } from 'node:crypto';

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Compute the hash for an audit log record.
 * Includes all immutable fields plus the previous record's hash.
 */
export function computeRecordHash(data: {
  id: string;
  event: string;
  severity: string;
  userId?: string | null;
  workspaceId?: string | null;
  metadata?: unknown;
  createdAt: Date;
  previousHash?: string | null;
}): string {
  const payload = JSON.stringify({
    id: data.id,
    event: data.event,
    severity: data.severity,
    userId: data.userId ?? null,
    workspaceId: data.workspaceId ?? null,
    metadata: data.metadata ?? null,
    createdAt: data.createdAt.toISOString(),
    previousHash: data.previousHash ?? null,
  });

  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Get the hash of the most recent audit log record.
 */
export async function getLatestHash(): Promise<string | null> {
  try {
    const latest = await prisma.auditLog.findFirst({
      where: { recordHash: { not: null } },
      select: { recordHash: true },
      orderBy: { createdAt: 'desc' },
    });
    return latest?.recordHash ?? null;
  } catch (error) {
    logger.debug('Failed to get latest audit hash', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

/**
 * Verify the integrity of the hash chain.
 * Returns the number of broken links found (0 = fully intact).
 */
export async function verifyHashChain(limit = 1000): Promise<{
  verified: number;
  broken: number;
  firstBrokenId?: string;
}> {
  const records = await prisma.auditLog.findMany({
    where: { recordHash: { not: null } },
    select: {
      id: true,
      event: true,
      severity: true,
      userId: true,
      workspaceId: true,
      metadata: true,
      createdAt: true,
      recordHash: true,
      previousHash: true,
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let verified = 0;
  let broken = 0;
  let firstBrokenId: string | undefined;
  let expectedPreviousHash: string | null = null;

  for (const record of records) {
    const computed = computeRecordHash({
      id: record.id,
      event: record.event as string,
      severity: record.severity as string,
      userId: record.userId,
      workspaceId: record.workspaceId,
      metadata: record.metadata,
      createdAt: record.createdAt,
      previousHash: expectedPreviousHash,
    });

    if (computed !== record.recordHash) {
      broken++;
      if (!firstBrokenId) firstBrokenId = record.id;
    } else {
      verified++;
    }

    expectedPreviousHash = record.recordHash;
  }

  return { verified, broken, firstBrokenId };
}
