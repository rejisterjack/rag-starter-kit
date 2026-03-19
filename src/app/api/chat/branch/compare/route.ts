/**
 * Branch Comparison API Route
 * 
 * Handles:
 * - GET /api/chat/branch/compare?branchA=x&branchB=y - Compare two branches
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { compareBranches } from "@/lib/rag/conversation-branch";

// =============================================================================
// GET - Compare two branches
// =============================================================================

export async function GET(req: Request) {
  try {
    // Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const branchAId = searchParams.get("branchA");
    const branchBId = searchParams.get("branchB");

    if (!branchAId || !branchBId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MISSING_IDS", message: "Both branchA and branchB are required" },
        },
        { status: 400 }
      );
    }

    // Verify user has access to both branches
    const [branchA, branchB] = await Promise.all([
      prisma.chat.findFirst({
        where: {
          id: branchAId,
          OR: [{ userId }, { workspaceId: workspaceId ?? "" }],
        },
      }),
      prisma.chat.findFirst({
        where: {
          id: branchBId,
          OR: [{ userId }, { workspaceId: workspaceId ?? "" }],
        },
      }),
    ]);

    if (!branchA || !branchB) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "One or both branches not found" },
        },
        { status: 404 }
      );
    }

    // Compare the branches
    const comparison = await compareBranches(branchAId, branchBId);

    return NextResponse.json({
      success: true,
      data: {
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
      },
    });
  } catch (error) {
    console.error("Failed to compare branches:", error);

    const errorMessage = error instanceof Error ? error.message : "Failed to compare branches";
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: errorMessage },
      },
      { status: 500 }
    );
  }
}
