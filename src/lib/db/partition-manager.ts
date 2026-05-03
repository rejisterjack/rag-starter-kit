/**
 * Table Partition Manager
 *
 * Manages PostgreSQL native range partitioning for high-growth tables.
 * Partitions are created monthly in advance and old ones are detached
 * instead of using DELETE (metadata-only operation, no table bloat).
 *
 * Note: Call `runPartitionMigration()` once during deployment to convert
 * existing tables to partitioned tables. This is a one-time operation.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const PARTITION_TABLES = ['audit_logs'] as const;

/**
 * Create partitions for the next N months ahead of time.
 * Safe to call repeatedly — skips existing partitions.
 */
export async function ensurePartitions(monthsAhead = 3): Promise<void> {
  for (const table of PARTITION_TABLES) {
    for (let i = 0; i < monthsAhead; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const partitionName = `${table}_${year}_${String(month).padStart(2, '0')}`;
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;

      const nextMonth = new Date(date);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const endDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS ${partitionName}
          PARTITION OF ${table}
          FOR VALUES FROM ('${startDate}') TO ('${endDate}')
        `);
        logger.debug('Partition ensured', { table, partition: partitionName });
      } catch (error) {
        logger.error('Failed to create partition', {
          table,
          partition: partitionName,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }
  }
}

/**
 * Detach and drop old partitions instead of using DELETE.
 * This is a metadata-only operation — no table bloat.
 */
export async function detachOldPartitions(retentionMonths: number): Promise<number> {
  let detached = 0;

  for (const table of PARTITION_TABLES) {
    try {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - retentionMonths);

      const result = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables
        WHERE tablename LIKE ${`${table}_%`}
        AND schemaname = 'public'
      `;

      for (const row of result) {
        const name = row.tablename;
        const match = name.match(/(\d{4})_(\d{2})$/);
        if (!match) continue;

        const year = Number.parseInt(match[1] as string, 10);
        const month = Number.parseInt(match[2] as string, 10);
        const partitionDate = new Date(year, month - 1, 1);

        if (partitionDate < cutoff) {
          try {
            await prisma.$executeRawUnsafe(`ALTER TABLE ${table} DETACH PARTITION ${name}`);
            await prisma.$executeRawUnsafe(`DROP TABLE ${name}`);
            detached++;
            logger.info('Detached old partition', { table, partition: name });
          } catch (error) {
            logger.error('Failed to detach partition', {
              table,
              partition: name,
              error: error instanceof Error ? error.message : 'Unknown',
            });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to list partitions', {
        table,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  return detached;
}
