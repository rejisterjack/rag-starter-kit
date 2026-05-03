/**
 * Video Parser — extracts audio track and transcribes via Whisper
 *
 * Supported formats: video/mp4, video/webm, video/quicktime, video/x-msvideo
 * Strategy: Extract audio → transcribe with Whisper → return text
 */

import { logger } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

export interface VideoParserResult {
  text: string;
  duration?: number;
  language?: string;
  metadata: {
    width?: number;
    height?: number;
    format: string;
    sizeBytes: number;
  };
}

export const SUPPORTED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/ogg',
] as const;

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv', 'm4v'];

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

// =============================================================================
// Validation
// =============================================================================

export function isVideoMimeType(mimeType: string): boolean {
  return SUPPORTED_VIDEO_MIME_TYPES.includes(
    mimeType as (typeof SUPPORTED_VIDEO_MIME_TYPES)[number]
  );
}

export function isVideoExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return VIDEO_EXTENSIONS.includes(ext);
}

// =============================================================================
// Parser
// =============================================================================

/**
 * Parse video by extracting audio and transcribing
 *
 * Since this runs in a Node.js context without ffmpeg, we use a two-step approach:
 * 1. If a Whisper API key is available, we send the video directly (Whisper supports video)
 * 2. Otherwise, return a placeholder
 */
export async function parseVideo(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<VideoParserResult> {
  if (!isVideoMimeType(mimeType) && !isVideoExtension(filename)) {
    throw new VideoParserError(
      `Unsupported video format: ${mimeType}. Supported: ${SUPPORTED_VIDEO_MIME_TYPES.join(', ')}`
    );
  }

  if (buffer.length > MAX_VIDEO_SIZE) {
    throw new VideoParserError(
      `Video file size (${formatBytes(buffer.length)}) exceeds limit of 100MB`
    );
  }

  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    logger.warn('No Whisper API key configured for video transcription', { filename, mimeType });
    return {
      text: `[Video transcription unavailable for "${filename}" — no API key configured. Set OPENAI_API_KEY to enable video transcription.]`,
      metadata: { format: mimeType, sizeBytes: buffer.length },
    };
  }

  const apiBase = process.env.OPENAI_API_KEY
    ? 'https://api.openai.com/v1'
    : 'https://openrouter.ai/api/v1';

  try {
    logger.info('Transcribing video file via Whisper', {
      filename,
      mimeType,
      size: formatBytes(buffer.length),
    });

    const ext = getExtensionForMimeType(mimeType, filename);
    const videoFilename = filename || `video.${ext}`;

    // Whisper API supports video files directly (extracts audio server-side)
    const formData = new FormData();
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    formData.append('file', blob, videoFilename);

    const response = await fetch(`${apiBase}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new VideoParserError(`Whisper API error (${response.status}): ${errorBody}`);
    }

    const result = (await response.json()) as {
      text: string;
      duration?: number;
      language?: string;
    };

    logger.info('Video transcription complete', {
      filename,
      duration: result.duration,
      language: result.language,
      textLength: result.text?.length || 0,
    });

    return {
      text: result.text || '',
      duration: result.duration,
      language: result.language,
      metadata: { format: mimeType, sizeBytes: buffer.length },
    };
  } catch (error: unknown) {
    if (error instanceof VideoParserError) throw error;

    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Video transcription failed', { filename, error: message });
    throw new VideoParserError(`Failed to transcribe video: ${message}`);
  }
}

// =============================================================================
// Helpers
// =============================================================================

export class VideoParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoParserError';
  }
}

function getExtensionForMimeType(mimeType: string, filename: string): string {
  const originalExt = filename.split('.').pop()?.toLowerCase();
  if (originalExt && VIDEO_EXTENSIONS.includes(originalExt)) return originalExt;

  const mimeToExt: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
    'video/ogg': 'ogv',
  };

  return mimeToExt[mimeType] || 'mp4';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
