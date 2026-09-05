import { NextResponse } from 'next/server';
import { createEmbeddingProviderFromEnv, validateEmbeddingDimensions } from '@/lib/ai/embeddings';
import { createProviderFromEnv } from '@/lib/ai/llm/factory';
import { apiError } from '@/lib/api-response';
import { requireAuth } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const maxDuration = 30;

interface TestResult {
  name: string;
  status: 'ok' | 'error';
  message?: string;
  latencyMs?: number;
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return apiError('NOT_FOUND', 'Not found', 404);
  }

  try {
    await requireAuth();
  } catch {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401);
  }

  const results: TestResult[] = [];

  // 1. Test embedding provider
  try {
    const start = Date.now();
    const provider = createEmbeddingProviderFromEnv();
    const embedding = await provider.embedQuery('test');
    const latencyMs = Date.now() - start;

    if (embedding.length === 0) {
      results.push({
        name: 'embedding',
        status: 'error',
        message: 'Embedding returned empty vector',
        latencyMs,
      });
    } else {
      results.push({ name: 'embedding', status: 'ok', latencyMs });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    results.push({ name: 'embedding', status: 'error', message });
    logger.error('Setup test: embedding failed', { error: message });
  }

  // 2. Test embedding dimension compatibility
  try {
    const dimResult = validateEmbeddingDimensions();
    if (dimResult.valid && !dimResult.message) {
      results.push({ name: 'dimensions', status: 'ok' });
    } else if (dimResult.valid) {
      results.push({ name: 'dimensions', status: 'ok', message: dimResult.message ?? undefined });
    } else {
      results.push({
        name: 'dimensions',
        status: 'error',
        message: dimResult.message ?? undefined,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    results.push({ name: 'dimensions', status: 'error', message });
  }

  // 3. Test LLM chat provider
  try {
    const start = Date.now();
    const llm = createProviderFromEnv();
    const response = await llm.generate([
      { role: 'user', content: 'Respond with exactly one word: OK' },
    ]);
    const latencyMs = Date.now() - start;
    const text = response.content?.trim();

    if (!text) {
      results.push({
        name: 'chat',
        status: 'error',
        message: 'LLM returned empty response',
        latencyMs,
      });
    } else {
      results.push({ name: 'chat', status: 'ok', latencyMs });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    results.push({ name: 'chat', status: 'error', message });
    logger.error('Setup test: chat failed', { error: message });
  }

  const allOk = results.every((r) => r.status === 'ok');
  return NextResponse.json({ success: allOk, results });
}
