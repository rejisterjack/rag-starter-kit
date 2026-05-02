/**
 * YouTube Transcript Parser
 * Fetches transcripts/captions from YouTube videos for RAG ingestion
 *
 * Uses the YouTube Data API v3 and a transcript fetching strategy
 */

import { logger } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

export interface YouTubeTranscriptResult {
  text: string;
  videoId: string;
  title?: string;
  channelName?: string;
  duration?: string;
  description?: string;
  captions: Array<{ start: number; duration?: number; text: string }>;
}

export interface YouTubeVideoMetadata {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;
  thumbnailUrl: string;
}

// =============================================================================
// URL Parsing
// =============================================================================

const YOUTUBE_URL_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
];

/**
 * Extract YouTube video ID from a URL
 */
export function extractVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Check if a URL is a YouTube video URL
 */
export function isYouTubeUrl(url: string): boolean {
  return extractVideoId(url) !== null;
}

// =============================================================================
// Video Metadata
// =============================================================================

/**
 * Fetch video metadata from YouTube Data API
 */
export async function fetchVideoMetadata(
  videoId: string,
  apiKey?: string
): Promise<YouTubeVideoMetadata | null> {
  const key = apiKey || process.env.YOUTUBE_API_KEY;
  if (!key) {
    logger.warn('No YouTube API key configured', { videoId });
    return null;
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${key}`;
    const response = await fetch(url);

    if (!response.ok) {
      logger.error('YouTube API error fetching metadata', {
        videoId,
        status: response.status,
      });
      return null;
    }

    const data = (await response.json()) as {
      items: Array<{
        snippet: {
          title: string;
          description: string;
          channelTitle: string;
          publishedAt: string;
          thumbnails: { high: { url: string } };
        };
        contentDetails: { duration: string };
      }>;
    };

    if (!data.items?.[0]) return null;

    const item = data.items[0];
    return {
      id: videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      duration: item.contentDetails.duration,
      thumbnailUrl: item.snippet.thumbnails.high.url,
    };
  } catch (error: unknown) {
    logger.error('Failed to fetch YouTube metadata', {
      videoId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// =============================================================================
// Transcript Fetching
// =============================================================================

interface TranscriptTrack {
  languageCode: string;
  name: { simpleText: string };
  kind?: string;
}

/**
 * Fetch transcript by parsing the YouTube watch page and extracting caption data
 */
export async function fetchTranscript(
  videoId: string,
  languageCode = 'en'
): Promise<Array<{ start: number; duration: number; text: string }>> {
  try {
    // Fetch the watch page HTML
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(watchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new YouTubeParserError(`Failed to fetch YouTube page (${response.status})`);
    }

    const html = await response.text();

    // Extract the player response data
    const captionTracks = extractCaptionTracks(html);

    if (!captionTracks || captionTracks.length === 0) {
      logger.info('No captions available for video', { videoId });
      return [];
    }

    // Find the best matching track
    const track =
      captionTracks.find((t) => t.languageCode === languageCode && !t.kind) ||
      captionTracks.find((t) => t.languageCode.startsWith(languageCode.split('-')[0])) ||
      captionTracks.find((t) => !t.kind) ||
      captionTracks[0];

    if (!track?.baseUrl) {
      return [];
    }

    // Fetch the caption XML
    const captionResponse = await fetch(track.baseUrl);
    if (!captionResponse.ok) {
      throw new YouTubeParserError(`Failed to fetch captions (${captionResponse.status})`);
    }

    const captionXml = await captionResponse.text();

    // Parse the XML into timed text events
    return parseCaptionXml(captionXml);
  } catch (error: unknown) {
    if (error instanceof YouTubeParserError) throw error;
    throw new YouTubeParserError(
      `Failed to fetch transcript: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Extract caption tracks from YouTube page HTML
 */
function extractCaptionTracks(
  html: string
): Array<{ languageCode: string; baseUrl: string; kind?: string }> {
  try {
    // Find the ytInitialPlayerResponse or playerCaptionsTracklistRenderer
    const captionsMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!captionsMatch?.[1]) return [];

    // Parse the JSON array
    const tracks = JSON.parse(captionsMatch[1]) as TranscriptTrack[];

    return tracks
      .map((track) => {
        const baseUrlMatch = captionsMatch[1].match(
          new RegExp(`"languageCode":"${track.languageCode}".*?"baseUrl":"(.*?)"`)
        );

        return {
          languageCode: track.languageCode,
          baseUrl: baseUrlMatch?.[1]?.replace(/\\u0026/g, '&') || '',
          kind: track.kind,
        };
      })
      .filter((t) => t.baseUrl);
  } catch (error: unknown) {
    logger.debug('Failed to extract caption tracks from YouTube page', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Parse YouTube caption XML into timed text events
 */
function parseCaptionXml(xml: string): Array<{ start: number; duration: number; text: string }> {
  const results: Array<{ start: number; duration: number; text: string }> = [];

  // Match <text start="..." dur="...">content</text>
  const textRegex = /<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: intentional regex loop
  while ((match = textRegex.exec(xml)) !== null) {
    const start = Number.parseFloat(match[1]) || 0;
    const duration = Number.parseFloat(match[2]) || 0;
    const rawText = match[3]
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();

    if (rawText) {
      results.push({ start, duration, text: rawText });
    }
  }

  // Fallback: try without duration attribute
  if (results.length === 0) {
    const simpleRegex = /<text[^>]*start="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;
    // biome-ignore lint/suspicious/noAssignInExpressions: intentional regex loop
    while ((match = simpleRegex.exec(xml)) !== null) {
      const start = Number.parseFloat(match[1]) || 0;
      const rawText = match[2]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();

      if (rawText) {
        results.push({ start, duration: 0, text: rawText });
      }
    }
  }

  return results;
}

// =============================================================================
// Main Parser
// =============================================================================

/**
 * Parse a YouTube video URL and extract its transcript
 */
export async function parseYouTube(
  url: string,
  options?: { languageCode?: string }
): Promise<YouTubeTranscriptResult> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new YouTubeParserError(`Invalid YouTube URL: ${url}`);
  }

  logger.info('Fetching YouTube transcript', { videoId, url });

  // Fetch metadata and transcript in parallel
  const [metadata, captions] = await Promise.all([
    fetchVideoMetadata(videoId),
    fetchTranscript(videoId, options?.languageCode),
  ]);

  // Build full text from captions
  let text: string;
  if (captions.length > 0) {
    const _fullText = captions.map((c) => c.text).join(' ');
    const formattedCaptions = captions
      .map((c) => {
        const timestamp = formatTimestamp(c.start);
        return `[${timestamp}] ${c.text}`;
      })
      .join('\n');

    text = `# ${metadata?.title || `YouTube Video ${videoId}`}\n\n`;
    if (metadata?.channelName) text += `Channel: ${metadata.channelName}\n`;
    if (metadata?.duration) text += `Duration: ${metadata.duration}\n`;
    if (metadata?.description) {
      const shortDesc = metadata.description.slice(0, 500);
      text += `\n## Description\n${shortDesc}${metadata.description.length > 500 ? '...' : ''}\n`;
    }
    text += `\n## Transcript\n\n${formattedCaptions}\n`;
  } else if (metadata?.description) {
    text = `# ${metadata.title}\n\nChannel: ${metadata.channelTitle}\n\n`;
    text += `## Description\n${metadata.description}\n\n`;
    text += `[No transcript/captions available for this video]`;
  } else {
    text = `[No transcript or metadata available for YouTube video ${videoId}]`;
  }

  return {
    text,
    videoId,
    title: metadata?.title,
    channelName: metadata?.channelTitle,
    duration: metadata?.duration,
    description: metadata?.description,
    captions,
  };
}

// =============================================================================
// Error & Helpers
// =============================================================================

export class YouTubeParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YouTubeParserError';
  }
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
