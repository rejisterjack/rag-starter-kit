import { Prisma } from '@/generated/prisma/client';
import type { VectorFilter } from './types';

export function toSqlVector(values: number[]): string {
  if (values.length === 0 || values.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
    throw new Error('Invalid embedding vector');
  }
  return `[${values.join(',')}]`;
}

export function sqlVector(values: number[]): Prisma.Sql {
  return Prisma.raw(`'${toSqlVector(values)}'::vector`);
}

function resolveFilter(filter?: VectorFilter): VectorFilter {
  if (!filter) return {};
  const nested = filter.filters;
  return {
    userId: nested?.userId ?? filter.userId,
    workspaceId: filter.workspaceId,
    documentIds: nested?.documentIds ?? filter.documentIds,
    documentTypes: nested?.documentTypes ?? filter.documentTypes,
    dateRange: nested?.dateRange ?? filter.dateRange,
  };
}

export function buildFilterSql(filter?: VectorFilter, alias = 'dc'): Prisma.Sql {
  const resolved = resolveFilter(filter);
  const parts: Prisma.Sql[] = [Prisma.sql`${Prisma.raw(`${alias}.embedding`)} IS NOT NULL`];

  if (resolved.userId && resolved.workspaceId) {
    parts.push(
      Prisma.sql`(${Prisma.raw(`${alias}."userId"`)} = ${resolved.userId} OR ${Prisma.raw(`${alias}."workspaceId"`)} = ${resolved.workspaceId})`
    );
  } else if (resolved.userId) {
    parts.push(Prisma.sql`${Prisma.raw(`${alias}."userId"`)} = ${resolved.userId}`);
  } else if (resolved.workspaceId) {
    parts.push(Prisma.sql`${Prisma.raw(`${alias}."workspaceId"`)} = ${resolved.workspaceId}`);
  }

  if (resolved.documentIds?.length) {
    parts.push(
      Prisma.sql`${Prisma.raw(`${alias}."documentId"`)} IN (${Prisma.join(resolved.documentIds)})`
    );
  }

  if (resolved.documentTypes?.length) {
    parts.push(
      Prisma.sql`${Prisma.raw(`${alias}."documentType"`)} IN (${Prisma.join(resolved.documentTypes)})`
    );
  }

  if (resolved.dateRange) {
    parts.push(
      Prisma.sql`${Prisma.raw(`${alias}."createdAt"`)} >= ${resolved.dateRange.from} AND ${Prisma.raw(`${alias}."createdAt"`)} <= ${resolved.dateRange.to}`
    );
  }

  return Prisma.join(parts, ' AND ');
}
