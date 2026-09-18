/**
 * Branch Comparison API Route
 *
 * Handles:
 * - GET /api/chat/branch/compare?branchA=x&branchB=y - Compare two branches
 */

import { apiError, apiSuccess } from '@/lib/api-response';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { compareBranches } from '@/lib/rag/conversation-branch';
// =============================================================================
// GET - Compare two branches
// =============================================================================

export async function GET(req: Request) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const branchAId = searchParams.get('branchA');
    const branchBId = searchParams.get('branchB');

    if (!branchAId || !branchBId) {
      return apiError('MISSING_IDS', 'Both branchA and branchB are required', 400);
    }

    // Verify user has access to both branches
    const [branchA, branchB] = await Promise.all([
      prisma.chat.findFirst({
        where: {
          id: branchAId,
          OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
        },
      }),
      prisma.chat.findFirst({
        where: {
          id: branchBId,
          OR: [{ userId }, { workspaceId: workspaceId ?? '' }],
        },
      }),
    ]);

    if (!branchA || !branchB) {
      return apiError('NOT_FOUND', 'One or both branches not found', 404);
    }

    // Compare the branches
    const comparison = await compareBranches(branchAId, branchBId);

    return apiSuccess({
      branchA: {
        id: comparison.branchA.id,
        messages: comparison.branchA.messages.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        })),
      },
      branchB: {
        id: comparison.branchB.id,
        messages: comparison.branchB.messages.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        })),
      },
      divergencePoint: comparison.divergencePoint,
      differences: comparison.differences,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to compare branches';
    return apiError('INTERNAL_ERROR', errorMessage, 500);
  }
}
