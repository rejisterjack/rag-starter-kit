/**
 * Audio Parser with OpenAI Whisper API
 * Transcribes audio files to text for RAG ingestion
 *
 * Supported formats: audio/mpeg, audio/wav, audio/webm, audio/ogg, audio/mp4
 * Uses OpenAI Whisper API for transcription
 */

import { logger } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

export interface AudioParserResult {
  text: string;
  duration?: number;
  language?: string;
  segments?: Array<{ start: number; end: number; text: string }>;
}

// Supported audio MIME types
export const SUPPORTED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/x-wav',
  'audio/wave',
  'audio/x-m4a',
  'audio/mp3',
] as const;

// Maximum file size for Whisper API (25MB)
const WHISPER_MAX_FILE_SIZE = 25 * 1024 * 1024;

// Audio file extensions
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'webm', 'ogg', 'm4a', 'mp4', 'flac', 'wma'];

/**
 * Check if a MIME type is a supported audio format
 */
export function isAudioMimeType(mimeType: string): boolean {
  return SUPPORTED_AUDIO_MIME_TYPES.includes(
    mimeType as (typeof SUPPORTED_AUDIO_MIME_TYPES)[number]
  );
}

/**
 * Check if a filename has an audio extension
 */
export function isAudioExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return AUDIO_EXTENSIONS.includes(ext);
}

/**
 * Get the appropriate file extension for a MIME type
 */
function getExtensionForMimeType(mimeType: string, filename: string): string {
  // Use original extension if available
  const originalExt = filename.split('.').pop()?.toLowerCase();
  if (originalExt && AUDIO_EXTENSIONS.includes(originalExt)) {
    return originalExt;
  }

  const mimeToExt: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/wave': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a',
  };

  return mimeToExt[mimeType] || 'mp3';
}

/**
 * Parse audio buffer and transcribe using OpenAI Whisper API
 */
export async function parseAudio(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<AudioParserResult> {
  // Validate MIME type
  if (!isAudioMimeType(mimeType) && !isAudioExtension(filename)) {
    throw new AudioParserError(
      `Unsupported audio format: ${mimeType}. Supported formats: ${SUPPORTED_AUDIO_MIME_TYPES.join(', ')}`
    );
  }

  // Check file size
  if (buffer.length > WHISPER_MAX_FILE_SIZE) {
    throw new AudioParserError(
      `Audio file size (${formatBytes(buffer.length)}) exceeds Whisper API limit of 25MB`
    );
  }

  // Get API key from environment
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    logger.warn(
      'No OpenAI API key found. Audio transcription requires OPENAI_API_KEY or OPENROUTER_API_KEY.',
      {
        filename,
        mimeType,
      }
    );

    return {
      text:
        `[Audio transcription unavailable for "${filename}" - no API key configured. ` +
        `Set OPENAI_API_KEY or OPENROUTER_API_KEY environment variable to enable audio transcription.]`,
      duration: undefined,
      language: undefined,
    };
  }

  // Determine the API base URL
  const apiBase = process.env.OPENAI_API_KEY
    ? 'https://api.openai.com/v1'
    : 'https://openrouter.ai/api/v1';

  try {
    logger.info('Transcribing audio file', {
      filename,
      mimeType,
      size: formatBytes(buffer.length),
    });

    // Build FormData for Whisper API
    const ext = getExtensionForMimeType(mimeType, filename);
    const audioFilename = filename || `audio.${ext}`;

    const formData = new FormData();
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    // Create a Blob from the buffer and append as file
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, audioFilename);

    // Call Whisper API
    const response = await fetch(`${apiBase}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new AudioParserError(`Whisper API error (${response.status}): ${errorBody}`);
    }

    const result = (await response.json()) as {
      text: string;
      duration?: number;
      language?: string;
      segments?: Array<{ start: number; end: number; text: string }>;
    };

    logger.info('Audio transcription complete', {
      filename,
      duration: result.duration,
      language: result.language,
      textLength: result.text?.length || 0,
    });

    return {
      text: result.text || '',
      duration: result.duration,
      language: result.language,
      segments: result.segments,
    };
  } catch (error) {
    if (error instanceof AudioParserError) {
      throw error;
    }

    logger.error('Audio transcription failed', {
      filename,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new AudioParserError(
      `Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Custom error class for audio parser errors
 */
export class AudioParserError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AudioParserError';
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
