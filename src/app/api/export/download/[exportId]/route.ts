/**
 * Export Download API Route
 * GET: Download an exported file
 */

import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { getExportService, getExportStorage, formatFileSize } from '@/lib/export';
import { logAuditEvent, AuditEvent } from '@/lib/audit/audit-logger';

// =============================================================================
// Route Parameters
// =============================================================================

interface RouteParams {
  params: Promise<{ exportId: string }>;
}

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { exportId } = await params;

    // Get export job
    const exportService = getExportService();
    const job = exportService.getJobStatus(exportId);

    if (!job) {
      return NextResponse.json(
        { error: 'Export not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify user owns this export
    if (job.userId !== userId) {
      await logAuditEvent({
        event: AuditEvent.PERMISSION_DENIED,
        userId,
        metadata: {
          action: 'download_export',
          exportId,
          ownerId: job.userId,
        },
        severity: 'WARNING',
      });

      return NextResponse.json(
        { error: 'Access denied', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Check if export is completed
    if (job.status !== 'completed') {
      return NextResponse.json(
        {
          error: 'Export not ready',
          code: 'NOT_READY',
          status: job.status,
          progress: job.progress,
        },
        { status: 400 }
      );
    }

    // Check if export has expired
    if (new Date() > job.expiresAt) {
      return NextResponse.json(
        { error: 'Export has expired', code: 'EXPIRED' },
        { status: 410 }
      );
    }

    // Retrieve file from storage
    const storage = getExportStorage();
    const fileInfo = await storage.getFileInfo(exportId);

    if (!fileInfo) {
      return NextResponse.json(
        { error: 'File not found', code: 'FILE_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get file buffer
    const buffer = await storage.retrieveFile(exportId);

    // Determine filename
    const format = job.format;
    const filename = job.metadata?.fileName ?? `export-${format}-${Date.now()}`;

    // Log download
    await logAuditEvent({
      event: AuditEvent.CHAT_MESSAGE_SENT,
      userId,
      workspaceId: job.workspaceId,
      metadata: {
        action: 'download_export',
        exportId,
        format: job.format,
        fileSize: fileInfo.size,
        fileName: filename,
      },
    });

    // Return file with appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', fileInfo.mimeType);
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Content-Length', buffer.length.toString());
    headers.set('Cache-Control', 'private, no-cache');
    headers.set('X-Export-Id', exportId);
    headers.set('X-File-Size', formatFileSize(fileInfo.size));

    // Optional: Delete file after download (for one-time downloads)
    // await storage.deleteFile(exportId);

    return new NextResponse(buffer as unknown as BodyInit, { headers });
  } catch (error) {
    console.error('Download export error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// HEAD Handler - Check export availability without downloading
// =============================================================================

export async function HEAD(_req: Request, { params }: RouteParams) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse(null, { status: 401 });
    }

    const userId = session.user.id;
    const { exportId } = await params;

    // Get export job
    const exportService = getExportService();
    const job = exportService.getJobStatus(exportId);

    if (!job || job.userId !== userId) {
      return new NextResponse(null, { status: 404 });
    }

    if (job.status !== 'completed') {
      return new NextResponse(null, {
        status: 400,
        headers: {
          'X-Status': job.status,
          'X-Progress': String(job.progress),
        },
      });
    }

    if (new Date() > job.expiresAt) {
      return new NextResponse(null, { status: 410 });
    }

    // Get file info
    const storage = getExportStorage();
    const fileInfo = await storage.getFileInfo(exportId);

    if (!fileInfo) {
      return new NextResponse(null, { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', fileInfo.mimeType);
    headers.set('Content-Length', String(fileInfo.size));
    headers.set('X-Expires-At', job.expiresAt.toISOString());
    headers.set('X-File-Size', formatFileSize(fileInfo.size));
    headers.set('X-Format', job.format);

    return new NextResponse(null, { headers });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
