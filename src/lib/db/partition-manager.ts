/**
 * Table Partition Manager
 *
 * Manages PostgreSQL native range partitioning for high-growth tables.
 * Partitions are created monthly in advance and old ones are detached
 * instead of using DELETE (metadata-only operation, no table bloat).
 *
 * Supported tables:
 *   - audit_logs        (partitioned by createdAt, monthly)
 *   - document_chunks   (partitioned by createdAt, monthly)
 *
 * Note: Call `runPartitionMigration()` once during deployment to convert
 * existing tables to partitioned tables. This is a one-time operation.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const PARTITION_TABLES = ['audit_logs', 'document_chunks'] as const;

/**
 * Validate that a table or partition name contains only safe characters.
 * Permitted patterns:
 *   - Simple table names: lowercase letters, digits, underscores (e.g. `audit_logs`)
 *   - Partition names: table_YYYY_YY or table_YYYY_YYYYMM (e.g. `audit_logs_2025_01`, `document_chunks_2025_202501`)
 *
 * Rejects any name containing special characters, spaces, or SQL injection payloads.
 */
function assertValidIdentifier(name: string, label = 'identifier'): void {
  // Allow: lowercase letters, digits, underscores — at least one char, must start with a letter or underscore
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Invalid ${label}: "${name}"`);
  }
}

/** Size thresholds for partition health checks */
const SIZE_THRESHOLDS = {
  /** Warn when the whole table exceeds this many bytes (1 GB) */
  TABLE_MAX_BYTES: 1_073_741_824,
  /** Warn when any single partition exceeds this many bytes (500 MB) */
  PARTITION_MAX_BYTES: 524_288_000,
  /** Number of future monthly partitions that should be pre-created */
  FUTURE_PARTITIONS_REQUIRED: 3,
} as const;

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
        assertValidIdentifier(partitionName, 'partition name');
        assertValidIdentifier(table, 'table name');
        // Date strings are safe: they are computed from Date objects, not user input.
        // Table/partition names are validated above.
        await prisma.$executeRawUnsafe(
          `CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF ${table} FOR VALUES FROM ('${startDate}') TO ('${endDate}')`
        );
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
        if (!match?.[1] || !match?.[2]) continue;

        const year = Number.parseInt(match[1], 10);
        const month = Number.parseInt(match[2], 10);
        const partitionDate = new Date(year, month - 1, 1);

        if (partitionDate < cutoff) {
          try {
            assertValidIdentifier(table, 'table name');
            assertValidIdentifier(name, 'partition name');
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

// ---------------------------------------------------------------------------
// document_chunks archival
// ---------------------------------------------------------------------------

/**
 * Archive document_chunks partitions that belong to a specific workspace and
 * are older than the supplied date.
 *
 * Steps for each qualifying partition:
 *  1. Detach the partition from the parent `document_chunks` table.
 *  2. Create (if necessary) and populate `document_chunks_archive` with the
 *     workspace's rows from that partition.
 *  3. Drop the detached partition.
 *
 * The corresponding Document rows in the main `Document` table are **not**
 * touched so that metadata remains available for reference.
 */
export async function archiveWorkspaceDocuments(
  workspaceId: string,
  olderThan: Date
): Promise<{ archivedPartitions: number; archivedRows: number }> {
  let archivedPartitions = 0;
  let archivedRows = 0;

  // Ensure the archive table exists. We use a plain (non-partitioned) table
  // so that it works regardless of whether the main table is partitioned.
  // This is a fully static query — no dynamic values.
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS document_chunks_archive (
      LIKE document_chunks INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES
    )
  `;

  // List all document_chunks partitions.
  const partitions = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE tablename LIKE 'document_chunks_%'
    AND schemaname = 'public'
  `;

  for (const row of partitions) {
    const name = row.tablename;
    const match = name.match(/(\d{4})_(\d{2})$/);
    if (!match) continue;

    const year = Number.parseInt(match[1] as string, 10);
    const month = Number.parseInt(match[2] as string, 10);
    const partitionDate = new Date(year, month - 1, 1);

    if (partitionDate >= olderThan) continue;

    // Check whether this partition actually contains rows for the workspace.
    assertValidIdentifier(name, 'partition name');
    const countResult = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
      `SELECT COUNT(*) AS cnt FROM ${name} dc INNER JOIN "Document" d ON d.id = dc."documentId" WHERE d."workspaceId" = $1`,
      workspaceId
    );
    const count = Number(countResult[0]?.cnt ?? 0);
    if (count === 0) continue;

    try {
      // Copy workspace rows into the archive table.
      await prisma.$executeRawUnsafe(
        `INSERT INTO document_chunks_archive (
          id, "documentId", content, index, start, end, page, section,
          embedding, "createdAt"
        )
        SELECT dc.id, dc."documentId", dc.content, dc.index, dc.start,
               dc.end, dc.page, dc.section, dc.embedding, dc."createdAt"
        FROM ${name} dc
        INNER JOIN "Document" d ON d.id = dc."documentId"
        WHERE d."workspaceId" = $1`,
        workspaceId
      );

      // Detach the partition from the parent table so we can safely mutate it.
      assertValidIdentifier(name, 'partition name');
      await prisma.$executeRawUnsafe(`ALTER TABLE document_chunks DETACH PARTITION ${name}`);

      // Delete the archived workspace rows from the now-detached partition so
      // they only exist in the archive table (prevents duplication on re-attach).
      await prisma.$executeRawUnsafe(
        `DELETE FROM ${name} dc USING "Document" d WHERE dc."documentId" = d.id AND d."workspaceId" = $1`,
        workspaceId
      );

      // If the partition is now empty we can drop it outright.  Otherwise
      // re-attach it so the remaining rows stay queryable.
      const totalResult = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
        `SELECT COUNT(*) AS cnt FROM ${name}`
      );
      const totalInPartition = Number(totalResult[0]?.cnt ?? 0);

      if (totalInPartition === 0) {
        await prisma.$executeRawUnsafe(`DROP TABLE ${name}`);
      } else {
        const yearStr = match[1];
        const monthStr = match[2];
        const startDate = `${yearStr}-${monthStr}-01`;
        const nextMonth = new Date(year, month, 1);
        const endDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

        await prisma.$executeRawUnsafe(`
          ALTER TABLE document_chunks ATTACH PARTITION ${name}
          FOR VALUES FROM ('${startDate}') TO ('${endDate}')
        `);
      }

      archivedPartitions++;
      archivedRows += count;
      logger.info('Archived workspace document_chunks partition', {
        workspaceId,
        partition: name,
        rowsArchived: count,
      });
    } catch (error) {
      logger.error('Failed to archive workspace partition', {
        workspaceId,
        partition: name,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  return { archivedPartitions, archivedRows };
}

// ---------------------------------------------------------------------------
// Partition statistics
// ---------------------------------------------------------------------------

export interface PartitionStats {
  /** Total on-disk size of the document_chunks table (bytes). */
  totalSizeBytes: number;
  /** Human-readable total size. */
  totalSizePretty: string;
  /** Per-partition breakdown. */
  partitions: PartitionDetail[];
  /** Estimated monthly growth rate in bytes (based on the last 3 partitions). */
  estimatedMonthlyGrowthBytes: number;
}

export interface PartitionDetail {
  name: string;
  sizeBytes: number;
  sizePretty: string;
  rowCount: number;
}

/**
 * Return size and row-count statistics for `document_chunks` and each of its
 * partitions.
 */
export async function getPartitionStats(): Promise<PartitionStats> {
  // Total table size (including all partitions and TOAST data).
  // Fully static query — no dynamic values.
  const totalResult = await prisma.$queryRaw<Array<{ pg_size_pretty: string; size_bytes: bigint }>>`
    SELECT pg_size_pretty(pg_total_relation_size('document_chunks')) AS pg_size_pretty,
           pg_total_relation_size('document_chunks') AS size_bytes
  `;

  const totalSizeBytes = Number(totalResult[0]?.size_bytes ?? 0);
  const totalSizePretty = String(totalResult[0]?.pg_size_pretty ?? '0 bytes');

  // Per-partition size + row count.
  // Fully static query — no dynamic values.
  const partitionRows = await prisma.$queryRaw<
    Array<{
      tablename: string;
      size_bytes: bigint;
      pg_size_pretty: string;
      row_count: bigint;
    }>
  >`
    SELECT
      c.relname          AS tablename,
      pg_total_relation_size(c.oid) AS size_bytes,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS pg_size_pretty,
      COALESCE(r.row_count, 0) AS row_count
    FROM pg_inherits i
    JOIN pg_class c       ON c.oid = i.inhrelid
    JOIN pg_class p       ON p.oid = i.inhparent
    JOIN pg_namespace n   ON n.oid = p.relnamespace
    LEFT JOIN LATERAL (
      SELECT reltuples::bigint AS row_count
      FROM pg_class pc WHERE pc.oid = c.oid
    ) r ON TRUE
    WHERE p.relname = 'document_chunks'
    AND n.nspname = 'public'
    ORDER BY c.relname
  `;

  const partitions: PartitionDetail[] = partitionRows.map((r) => ({
    name: r.tablename,
    sizeBytes: Number(r.size_bytes),
    sizePretty: String(r.pg_size_pretty),
    rowCount: Number(r.row_count),
  }));

  // Estimate monthly growth from the most recent 3 partitions that have data.
  const withData = partitions.filter((p) => p.sizeBytes > 0).slice(-3);
  let estimatedMonthlyGrowthBytes = 0;
  if (withData.length >= 2) {
    const avgSize = withData.reduce((sum, p) => sum + p.sizeBytes, 0) / withData.length;
    estimatedMonthlyGrowthBytes = Math.round(avgSize);
  } else if (withData.length === 1) {
    estimatedMonthlyGrowthBytes = withData[0]?.sizeBytes ?? 0;
  }

  return {
    totalSizeBytes,
    totalSizePretty,
    partitions,
    estimatedMonthlyGrowthBytes,
  };
}

// ---------------------------------------------------------------------------
// Partition health monitoring
// ---------------------------------------------------------------------------

export interface PartitionHealthWarning {
  level: 'critical' | 'warning';
  message: string;
  detail?: Record<string, unknown>;
}

export interface PartitionHealthReport {
  healthy: boolean;
  warnings: PartitionHealthWarning[];
  checkedAt: Date;
}

/**
 * Check the health of document_chunks partitions and surface warnings when
 * thresholds are exceeded or future partitions are missing.
 */
export async function checkPartitionHealth(): Promise<PartitionHealthReport> {
  const warnings: PartitionHealthWarning[] = [];

  const stats = await getPartitionStats();

  // 1. Total table size exceeds 1 GB.
  if (stats.totalSizeBytes > SIZE_THRESHOLDS.TABLE_MAX_BYTES) {
    warnings.push({
      level: 'critical',
      message: `document_chunks total size (${stats.totalSizePretty}) exceeds the 1 GB threshold.`,
      detail: { totalSizeBytes: stats.totalSizeBytes },
    });
  }

  // 2. Any single partition exceeds 500 MB.
  for (const p of stats.partitions) {
    if (p.sizeBytes > SIZE_THRESHOLDS.PARTITION_MAX_BYTES) {
      warnings.push({
        level: 'warning',
        message: `Partition ${p.name} (${p.sizePretty}) exceeds the 500 MB threshold.`,
        detail: {
          partition: p.name,
          sizeBytes: p.sizeBytes,
          rowCount: p.rowCount,
        },
      });
    }
  }

  // 3. Verify that the next 3 monthly partitions are pre-created.
  const existingNames = new Set(stats.partitions.map((p) => p.name));
  const now = new Date();

  for (let i = 1; i <= SIZE_THRESHOLDS.FUTURE_PARTITIONS_REQUIRED; i++) {
    const future = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const expectedName = `document_chunks_${future.getFullYear()}_${String(future.getMonth() + 1).padStart(2, '0')}`;

    if (!existingNames.has(expectedName)) {
      warnings.push({
        level: 'warning',
        message: `Future partition ${expectedName} is not pre-created.`,
        detail: { expectedPartition: expectedName },
      });
    }
  }

  if (warnings.length > 0) {
    logger.warn('Partition health check warnings', {
      warningCount: warnings.length,
      warnings: warnings.map((w) => w.message),
    });
  } else {
    logger.info('Partition health check passed');
  }

  return {
    healthy: warnings.length === 0,
    warnings,
    checkedAt: new Date(),
  };
}
