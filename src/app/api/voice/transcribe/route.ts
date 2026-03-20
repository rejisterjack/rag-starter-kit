/**
 * Voice Transcription API Route
 * Fallback API using OpenAI Whisper for speech-to-text
 * Used when Web Speech API is not available
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuditEvent, logAuditEvent } from '@/lib/audit/audit-logger';
import { auth } from '@/lib/auth';
import {
  addRateLimitHeaders,
  checkApiRateLimit,
  getRateLimitIdentifier,
} from '@/lib/security/rate-limiter';

// =============================================================================
// Configuration
// =============================================================================

const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
const WHISPER_MODEL = 'whisper-1';

// Supported audio formats
const SUPPORTED_FORMATS = [
  'audio/flac',
  'audio/m4a',
  'audio/mp3',
  'audio/mp4',
  'audio/mpeg',
  'audio/mpga',
  'audio/oga',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
];

// Maximum file size (25MB as per OpenAI's limit)
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// =============================================================================
// Validation Schema
// =============================================================================

const transcriptionSchema = z.object({
  language: z.string().optional(),
  prompt: z.string().max(244, 'Prompt too long').optional(),
  response_format: z.enum(['json', 'text', 'srt', 'verbose_json', 'vtt']).default('json'),
});

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Step 1: Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const userId = session.user.id;
    const workspaceId = session.user.workspaceId;

    // Step 2: Check rate limit
    const rateLimitIdentifier = getRateLimitIdentifier(req, { userId, workspaceId });
    const rateLimitResult = await checkApiRateLimit(rateLimitIdentifier, 'voice', {
      userId,
      workspaceId,
      endpoint: '/api/voice/transcribe',
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
          resetAt: new Date(rateLimitResult.reset).toISOString(),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Step 3: Parse multipart form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: 'Invalid form data', code: 'INVALID_BODY' },
        { status: 400 }
      );
    }

    // Step 4: Validate audio file
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided', code: 'MISSING_AUDIO' },
        { status: 400 }
      );
    }

    // Check file size
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'Audio file too large',
          code: 'FILE_TOO_LARGE',
          details: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        },
        { status: 413 }
      );
    }

    // Check file type
    if (!SUPPORTED_FORMATS.includes(audioFile.type)) {
      return NextResponse.json(
        {
          error: 'Unsupported audio format',
          code: 'UNSUPPORTED_FORMAT',
          details: `Supported formats: ${SUPPORTED_FORMATS.join(', ')}`,
        },
        { status: 415 }
      );
    }

    // Step 5: Parse and validate options
    const options: Record<string, unknown> = {};

    try {
      const language = formData.get('language') as string | null;
      const prompt = formData.get('prompt') as string | null;
      const responseFormat = formData.get('response_format') as string | null;

      if (language) options.language = language;
      if (prompt) options.prompt = prompt;
      if (responseFormat) options.response_format = responseFormat;

      const validatedOptions = transcriptionSchema.parse(options);
      Object.assign(options, validatedOptions);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid options',
            code: 'VALIDATION_ERROR',
            details: error.issues,
          },
          { status: 400 }
        );
      }
    }

    // Step 6: Prepare request to OpenAI
    const openaiFormData = new FormData();
    openaiFormData.append('file', audioFile);
    openaiFormData.append('model', WHISPER_MODEL);

    if (options.language) {
      openaiFormData.append('language', options.language as string);
    }
    if (options.prompt) {
      openaiFormData.append('prompt', options.prompt as string);
    }
    if (options.response_format) {
      openaiFormData.append('response_format', options.response_format as string);
    }

    // Step 7: Call OpenAI Whisper API
    const openaiResponse = await fetch(WHISPER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: openaiFormData,
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json().catch(() => ({}));

      return NextResponse.json(
        {
          error: 'Transcription failed',
          code: 'TRANSCRIPTION_ERROR',
          details: errorData.error?.message || 'Unknown error from Whisper API',
        },
        { status: 502 }
      );
    }

    // Step 8: Parse response
    const transcriptionData = await openaiResponse.json();
    const latency = Date.now() - startTime;

    // Step 9: Log audit event
    await logAuditEvent({
      event: AuditEvent.VOICE_TRANSCRIPTION,
      userId,
      workspaceId,
      metadata: {
        fileSize: audioFile.size,
        fileType: audioFile.type,
        duration: transcriptionData.duration,
        language: options.language,
        latencyMs: latency,
      },
    });

    // Step 10: Return response
    const response = NextResponse.json({
      success: true,
      data: {
        text: transcriptionData.text,
        language: transcriptionData.language,
        duration: transcriptionData.duration,
        confidence: transcriptionData.confidence,
      },
    });

    addRateLimitHeaders(response.headers, rateLimitResult);

    return response;
  } catch (error) {
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
// GET Handler - Get supported formats and languages
// =============================================================================

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      supportedFormats: SUPPORTED_FORMATS,
      maxFileSize: MAX_FILE_SIZE,
      model: WHISPER_MODEL,
      supportedLanguages: [
        { code: 'en', name: 'English' },
        { code: 'zh', name: 'Chinese' },
        { code: 'de', name: 'German' },
        { code: 'es', name: 'Spanish' },
        { code: 'ru', name: 'Russian' },
        { code: 'ko', name: 'Korean' },
        { code: 'fr', name: 'French' },
        { code: 'ja', name: 'Japanese' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'tr', name: 'Turkish' },
        { code: 'pl', name: 'Polish' },
        { code: 'ca', name: 'Catalan' },
        { code: 'nl', name: 'Dutch' },
        { code: 'ar', name: 'Arabic' },
        { code: 'sv', name: 'Swedish' },
        { code: 'it', name: 'Italian' },
        { code: 'id', name: 'Indonesian' },
        { code: 'hi', name: 'Hindi' },
        { code: 'fi', name: 'Finnish' },
        { code: 'vi', name: 'Vietnamese' },
        { code: 'he', name: 'Hebrew' },
        { code: 'uk', name: 'Ukrainian' },
        { code: 'el', name: 'Greek' },
        { code: 'ms', name: 'Malay' },
        { code: 'cs', name: 'Czech' },
        { code: 'ro', name: 'Romanian' },
        { code: 'da', name: 'Danish' },
        { code: 'hu', name: 'Hungarian' },
        { code: 'ta', name: 'Tamil' },
        { code: 'no', name: 'Norwegian' },
        { code: 'th', name: 'Thai' },
        { code: 'ur', name: 'Urdu' },
        { code: 'hr', name: 'Croatian' },
        { code: 'bg', name: 'Bulgarian' },
        { code: 'lt', name: 'Lithuanian' },
        { code: 'la', name: 'Latin' },
        { code: 'mi', name: 'Maori' },
        { code: 'ml', name: 'Malayalam' },
        { code: 'cy', name: 'Welsh' },
        { code: 'sk', name: 'Slovak' },
        { code: 'te', name: 'Telugu' },
        { code: 'fa', name: 'Persian' },
        { code: 'lv', name: 'Latvian' },
        { code: 'bn', name: 'Bengali' },
        { code: 'sr', name: 'Serbian' },
        { code: 'az', name: 'Azerbaijani' },
        { code: 'sl', name: 'Slovenian' },
        { code: 'kn', name: 'Kannada' },
        { code: 'et', name: 'Estonian' },
        { code: 'mk', name: 'Macedonian' },
        { code: 'br', name: 'Breton' },
        { code: 'eu', name: 'Basque' },
        { code: 'is', name: 'Icelandic' },
        { code: 'hy', name: 'Armenian' },
        { code: 'ne', name: 'Nepali' },
        { code: 'mn', name: 'Mongolian' },
        { code: 'bs', name: 'Bosnian' },
        { code: 'kk', name: 'Kazakh' },
        { code: 'sq', name: 'Albanian' },
        { code: 'sw', name: 'Swahili' },
        { code: 'gl', name: 'Galician' },
        { code: 'mr', name: 'Marathi' },
        { code: 'pa', name: 'Punjabi' },
        { code: 'si', name: 'Sinhala' },
        { code: 'km', name: 'Khmer' },
        { code: 'sn', name: 'Shona' },
        { code: 'yo', name: 'Yoruba' },
        { code: 'so', name: 'Somali' },
        { code: 'af', name: 'Afrikaans' },
        { code: 'oc', name: 'Occitan' },
        { code: 'ka', name: 'Georgian' },
        { code: 'be', name: 'Belarusian' },
        { code: 'tg', name: 'Tajik' },
        { code: 'sd', name: 'Sindhi' },
        { code: 'gu', name: 'Gujarati' },
        { code: 'am', name: 'Amharic' },
        { code: 'yi', name: 'Yiddish' },
        { code: 'lo', name: 'Lao' },
        { code: 'uz', name: 'Uzbek' },
        { code: 'fo', name: 'Faroese' },
        { code: 'ht', name: 'Haitian Creole' },
        { code: 'ps', name: 'Pashto' },
        { code: 'tk', name: 'Turkmen' },
        { code: 'nn', name: 'Nynorsk' },
        { code: 'mt', name: 'Maltese' },
        { code: 'sa', name: 'Sanskrit' },
        { code: 'lb', name: 'Luxembourgish' },
        { code: 'my', name: 'Myanmar' },
        { code: 'bo', name: 'Tibetan' },
        { code: 'tl', name: 'Tagalog' },
        { code: 'mg', name: 'Malagasy' },
        { code: 'as', name: 'Assamese' },
        { code: 'tt', name: 'Tatar' },
        { code: 'haw', name: 'Hawaiian' },
        { code: 'ln', name: 'Lingala' },
        { code: 'ha', name: 'Hausa' },
        { code: 'ba', name: 'Bashkir' },
        { code: 'jw', name: 'Javanese' },
        { code: 'su', name: 'Sundanese' },
      ],
    },
  });
}
