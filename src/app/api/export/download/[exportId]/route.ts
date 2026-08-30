/**
 * Export Download API Route
 * GET: Download an exported file
 */

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { withApiAuth } from '@/lib/auth';
import { formatFileSize, getExportService, getExportStorage } from '@/lib/export';
import { logger } from '@/lib/logger';

// =============================================================================
// Route Parameters
// =============================================================================

interface RouteParams {
  params: Promise<{ exportId: string }>;
}

// =============================================================================
// GET Handler
// =============================================================================

export const GET = withApiAuth(async (_req: Request, session, { params }: RouteParams) => {
  try {
    const userId = session.user.id;
    const { exportId } = await params;

    // Get export job
    const exportService = getExportService();
    const job = exportService.getJobStatus(exportId);

    if (!job) {
      return apiError('NOT_FOUND', 'Export not found', 404);
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

      return apiError('FORBIDDEN', 'Access denied', 403);
    }

    // Check if export is completed
    if (job.status !== 'completed') {
      return apiError('NOT_READY', 'Export not ready', 400);
    }

    // Check if export has expired
    if (new Date() > job.expiresAt) {
      return apiError('EXPIRED', 'Export has expired', 410);
    }

    // Retrieve file from storage
    const storage = getExportStorage();
    const fileInfo = await storage.getFileInfo(exportId);

    if (!fileInfo) {
      return apiError('FILE_NOT_FOUND', 'File not found', 404);
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

    return new NextResponse(new Uint8Array(buffer), { headers });
  } catch (error) {
    return apiError(
      'INTERNAL_ERROR',
      'Internal server error',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
});

// =============================================================================
// HEAD Handler - Check export availability without downloading
// =============================================================================

export const HEAD = withApiAuth(async (_req: Request, session, { params }: RouteParams) => {
  try {
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
  } catch (error: unknown) {
    logger.error('Failed to check export availability', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return new NextResponse(null, { status: 500 });
  }
});
