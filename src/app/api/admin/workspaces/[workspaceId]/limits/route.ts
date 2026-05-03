/**
 * Admin Workspace Limits API
 * GET /api/admin/workspaces/[workspaceId]/limits - Get workspace limits and usage
 * PUT /api/admin/workspaces/[workspaceId]/limits - Update workspace limits (admin only)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth } from '@/lib/auth';
import { prisma, prismaRead } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getWorkspaceResourceUsage } from '@/lib/workspace/resource-limits';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

const updateLimitsSchema = z.object({
  maxDocuments: z.number().int().min(1).max(100000).optional(),
  maxStorageMb: z.number().int().min(1).max(1048576).optional(), // max 1TB
  maxChats: z.number().int().min(1).max(1000000).optional(),
  maxChatPerDay: z.number().int().min(1).max(10000).optional(),
  llmProvider: z.enum(['openrouter', 'openai', 'anthropic', 'ollama']).nullable().optional(),
  llmModel: z.string().max(200).nullable().optional(),
});

// =============================================================================
// GET - Retrieve limits and usage for a workspace
// =============================================================================

export const GET = withApiAuth(async (_req, session, { params }: RouteParams) => {
  try {
    // Admin-only check
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { workspaceId } = await params;

    const workspace = await prismaRead.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        maxDocuments: true,
        maxStorageMb: true,
        maxChats: true,
        maxChatPerDay: true,
        llmProvider: true,
        llmModel: true,
      },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const usage = await getWorkspaceResourceUsage(workspaceId);

    return NextResponse.json({
      success: true,
      limits: {
        maxDocuments: workspace.maxDocuments,
        maxStorageMb: workspace.maxStorageMb,
        maxChats: workspace.maxChats,
        maxChatPerDay: workspace.maxChatPerDay,
        llmProvider: workspace.llmProvider,
        llmModel: workspace.llmModel,
      },
      usage,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      },
    });
  } catch (error: unknown) {
    logger.error('Failed to fetch workspace limits', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to fetch limits' }, { status: 500 });
  }
});

// =============================================================================
// PUT - Update limits for a workspace (admin only)
// =============================================================================

export const PUT = withApiAuth(async (req, session, { params }: RouteParams) => {
  try {
    // Admin-only check
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { workspaceId } = await params;

    // Verify workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Parse and validate body
    const body = await req.json();
    const validation = updateLimitsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid limits', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Build update payload (only include fields that were provided)
    const updateData: Record<string, unknown> = {};
    if (updates.maxDocuments !== undefined) updateData.maxDocuments = updates.maxDocuments;
    if (updates.maxStorageMb !== undefined) updateData.maxStorageMb = updates.maxStorageMb;
    if (updates.maxChats !== undefined) updateData.maxChats = updates.maxChats;
    if (updates.maxChatPerDay !== undefined) updateData.maxChatPerDay = updates.maxChatPerDay;
    if (updates.llmProvider !== undefined) updateData.llmProvider = updates.llmProvider;
    if (updates.llmModel !== undefined) updateData.llmModel = updates.llmModel;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Update workspace
    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: updateData,
      select: {
        maxDocuments: true,
        maxStorageMb: true,
        maxChats: true,
        maxChatPerDay: true,
        llmProvider: true,
        llmModel: true,
      },
    });

    // Get fresh usage stats
    const usage = await getWorkspaceResourceUsage(workspaceId);

    logger.info('Workspace limits updated by admin', {
      userId: session.user.id,
      workspaceId,
      updates: Object.keys(updateData),
    });

    return NextResponse.json({
      success: true,
      limits: updated,
      usage,
    });
  } catch (error: unknown) {
    logger.error('Failed to update workspace limits', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to update limits' }, { status: 500 });
  }
});
