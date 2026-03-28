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
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, processing, ready, error]
 *     responses:
 *       200:
 *         description: List of documents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Document'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     limit: { type: integer }
 *                     offset: { type: integer }
 *       401:
 *         description: Unauthorized
 */

import type { DocumentStatus } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getServerSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

/**
 * GET /api/v1/documents
 * List documents with pagination and filtering
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  // Get workspace from API key or query param
  const workspace = await getServerSession();
  if (!workspace) {
    return NextResponse.json(
      { error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const status = searchParams.get('status') as DocumentStatus | undefined;

  const where = {
    workspaceId: workspace.id,
    ...(status && { status: status as DocumentStatus }),
  };

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        contentType: true,
        status: true,
        size: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
      },
    }),
    prisma.document.count({ where }),
  ]);

  return NextResponse.json({
    data: documents.map((doc) => ({
      ...doc,
      size: Number(doc.size),
    })),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  });
}
