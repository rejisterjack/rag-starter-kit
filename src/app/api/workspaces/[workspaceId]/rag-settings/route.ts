/**
 * Workspace RAG Settings API
 * GET /api/workspaces/[workspaceId]/rag-settings - Get RAG settings
 * PUT /api/workspaces/[workspaceId]/rag-settings - Update RAG settings
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiAuth } from '@/lib/auth';
import { prisma, prismaRead } from '@/lib/db/client';
import { logger } from '@/lib/logger';
import { checkPermission, Permission } from '@/lib/workspace/permissions';
import { getWorkspaceResourceUsage } from '@/lib/workspace/resource-limits';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

const ragSettingsSchema = z.object({
  chunkSize: z.number().min(100).max(4000).default(1000),
  chunkOverlap: z.number().min(0).max(1000).default(200),
  topK: z.number().min(1).max(20).default(5),
  similarityThreshold: z.number().min(0).max(1).default(0.7),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(256).max(8192).default(2000),
  embeddingModel: z.string().default('text-embedding-004'),
  rerankingEnabled: z.boolean().default(false),
  hybridSearchEnabled: z.boolean().default(true),
  chunkingStrategy: z.enum(['fixed', 'semantic', 'hierarchical', 'late']).default('fixed'),
  // Per-workspace LLM configuration
  llmProvider: z.enum(['openrouter', 'openai', 'anthropic', 'ollama']).nullable().optional(),
  llmModel: z.string().max(200).nullable().optional(),
});

export const GET = withApiAuth(async (_req, session, { params }: RouteParams) => {
  try {
    const { workspaceId } = await params;

    // Check permissions
    const hasAccess = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.READ_DOCUMENTS
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get workspace settings
    const workspace = await prismaRead.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true, llmProvider: true, llmModel: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Parse RAG settings from workspace settings JSON
    const settings = workspace.settings as Record<string, unknown> | null;
    const ragSettings = settings?.rag || {};

    // Get current resource usage
    const resourceUsage = await getWorkspaceResourceUsage(workspaceId);

    return NextResponse.json({
      success: true,
      settings: ragSettings,
      llmProvider: workspace.llmProvider,
      llmModel: workspace.llmModel,
      resourceUsage,
    });
  } catch (error: unknown) {
    logger.error('Failed to fetch RAG settings', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
});

export const PUT = withApiAuth(async (req, session, { params }: RouteParams) => {
  try {
    const { workspaceId } = await params;

    // Check permissions
    const hasAccess = await checkPermission(
      session.user.id,
      workspaceId,
      Permission.MANAGE_SETTINGS
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse and validate body
    const body = await req.json();
    const validation = ragSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid settings', details: validation.error.errors },
        { status: 400 }
      );
    }

    const ragSettings = validation.data;

    // Get current workspace settings
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Merge with existing settings
    const currentSettings = (workspace.settings as Record<string, unknown>) || {};
    const updatedSettings = {
      ...currentSettings,
      rag: {
        chunkSize: ragSettings.chunkSize,
        chunkOverlap: ragSettings.chunkOverlap,
        topK: ragSettings.topK,
        similarityThreshold: ragSettings.similarityThreshold,
        temperature: ragSettings.temperature,
        maxTokens: ragSettings.maxTokens,
        embeddingModel: ragSettings.embeddingModel,
        rerankingEnabled: ragSettings.rerankingEnabled,
        hybridSearchEnabled: ragSettings.hybridSearchEnabled,
        chunkingStrategy: ragSettings.chunkingStrategy,
      },
    };

    // Build update data including LLM overrides if provided
    const updateData: Record<string, unknown> = { settings: updatedSettings };
    if (ragSettings.llmProvider !== undefined) {
      updateData.llmProvider = ragSettings.llmProvider;
    }
    if (ragSettings.llmModel !== undefined) {
      updateData.llmModel = ragSettings.llmModel;
    }

    // Update workspace
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      settings: updatedSettings.rag,
      llmProvider: ragSettings.llmProvider ?? null,
      llmModel: ragSettings.llmModel ?? null,
    });
  } catch (error: unknown) {
    logger.error('Failed to update RAG settings', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
});
