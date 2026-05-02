/**
 * @openapi
 * /api/v1/documents:
 *   get:
 *     summary: List documents
 *     description: Retrieve a paginated list of documents in the workspace
 *     tags: [Documents]
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - name: cursor
 *         in: query
 *         schema:
 *           type: string
 *           description: Cursor for next/previous page
 *       - name: direction
 *         in: query
 *         schema:
 *           type: string
 *           enum: [forward, backward]
 *           default: forward
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, processing, ready, error]
 *     responses:
 *       200:
 *         description: List of documents
 *       401:
 *         description: Unauthorized
 */

import type { DocumentStatus } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getServerSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import {
  buildCursorQuery,
  buildPaginationResult,
  createPaginationHeaders,
  parsePaginationParams,
  validatePaginationParams,
} from '@/lib/db/cursor-pagination';

/**
 * GET /api/v1/documents
 * List documents with cursor-based pagination and filtering
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  const workspace = await getServerSession();
  if (!workspace) {
    return NextResponse.json(
      { error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(request.url);
  const paginationParams = parsePaginationParams(searchParams);
  const validation = validatePaginationParams(paginationParams);

  if (!validation.valid) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: validation.error } },
      { status: 400 }
    );
  }

  const status = searchParams.get('status') as DocumentStatus | undefined;
  const {
    takeCount,
    where: cursorWhere,
    orderBy,
  } = buildCursorQuery<{ id: string; updatedAt: Date }>(paginationParams, {
    cursorField: 'updatedAt',
  });

  const where = {
    workspaceId: workspace.id,
    ...(status && { status: status as DocumentStatus }),
    ...cursorWhere,
  };

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy,
      take: takeCount,
      select: {
        id: true,
        name: true,
        contentType: true,
        status: true,
        size: true,
        updatedAt: true,
        createdAt: true,
        metadata: true,
      },
    }),
    prisma.document.count({
      where: { workspaceId: workspace.id, ...(status && { status: status as DocumentStatus }) },
    }),
  ]);

  const result = buildPaginationResult(documents, paginationParams, {
    cursorField: 'updatedAt',
    totalCount: total,
  });

  const headers = createPaginationHeaders(result);
  return NextResponse.json(
    {
      data: result.items.map((doc) => ({
        ...doc,
        size: Number(doc.size),
      })),
      pagination: result.pagination,
    },
    { headers }
  );
}
