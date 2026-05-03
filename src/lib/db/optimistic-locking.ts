/**
 * Optimistic Concurrency Control
 *
 * Prevents silent overwrites when concurrent requests modify the same entity.
 * Clients must send the current version via If-Match header. The update
 * includes a WHERE clause on the version — if it doesn't match, the update
 * affects zero rows and a ConcurrentModificationError is thrown.
 */

import { prisma } from '@/lib/db';

export class ConcurrentModificationError extends Error {
  constructor(
    public readonly model: string,
    public readonly id: string,
    public readonly expectedVersion: number
  ) {
    super(`${model} ${id} was modified by another request (expected version ${expectedVersion})`);
    this.name = 'ConcurrentModificationError';
  }
}

/**
 * Update a record with optimistic concurrency check.
 * Increments the version field on success.
 * Throws ConcurrentModificationError if the version doesn't match.
 */
export async function updateWithVersion(
  model: 'document' | 'chat' | 'workspace',
  id: string,
  data: Record<string, unknown>,
  expectedVersion: number
): Promise<Record<string, unknown>> {
  // @ts-expect-error — dynamic model access
  const result = await prisma[model].updateMany({
    where: { id, version: expectedVersion },
    data: {
      ...data,
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    throw new ConcurrentModificationError(model, id, expectedVersion);
  }

  // @ts-expect-error — dynamic model access
  return prisma[model].findUniqueOrThrow({ where: { id } });
}

/**
 * Extract the expected version from an If-Match header.
 */
export function extractVersion(headers: Headers): number | null {
  const ifMatch = headers.get('if-match');
  if (!ifMatch) return null;
  const version = Number.parseInt(ifMatch, 10);
  return Number.isNaN(version) ? null : version;
}
