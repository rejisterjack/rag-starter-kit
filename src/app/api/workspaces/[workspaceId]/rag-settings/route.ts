/**
 * Workspace RAG Settings API
 * GET /api/workspaces/[workspaceId]/rag-settings - Get RAG settings
 * PUT /api/workspaces/[workspaceId]/rag-settings - Update RAG settings
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/client';
import { checkPermission, Permission } from '@/lib/workspace/permissions';

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
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Parse RAG settings from workspace settings JSON
    const settings = workspace.settings as Record<string, unknown> | null;
    const ragSettings = settings?.rag || {};

    return NextResponse.json({
      success: true,
      settings: ragSettings,
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      rag: ragSettings,
    };

    // Update workspace
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings: updatedSettings },
    });

    return NextResponse.json({
      success: true,
      settings: ragSettings,
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
