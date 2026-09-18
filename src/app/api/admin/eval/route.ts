import { apiError, apiSuccess } from '@/lib/api-response';
/**
 * Admin Evaluation API
 *
 * GET  - List saved evaluation reports from the eval-results directory.
 * POST - Trigger a new evaluation run.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { APP_URL } from '@/lib/constants';
import { EvalRunner } from '@/lib/eval/runner';
import type { EvalDataset, EvalReport } from '@/lib/eval/types';
import { logger } from '@/lib/logger';

const EVAL_RESULTS_DIR = resolve(process.cwd(), 'eval-results');

function ensureResultsDir(): void {
  if (!existsSync(EVAL_RESULTS_DIR)) {
    mkdirSync(EVAL_RESULTS_DIR, { recursive: true });
  }
}

// =============================================================================
// GET - List reports
// =============================================================================

export async function GET(): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return apiError('NOT_FOUND', 'Not found', 404);
  }

  try {
    await requireAdmin();
    ensureResultsDir();

    const files = readdirSync(EVAL_RESULTS_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse(); // newest first

    const reports: Array<{ filename: string; report: EvalReport }> = [];

    for (const file of files) {
      try {
        const raw = readFileSync(join(EVAL_RESULTS_DIR, file), 'utf-8');
        const report = JSON.parse(raw) as EvalReport;
        reports.push({ filename: file, report });
      } catch (readError: unknown) {
        logger.warn('Failed to read eval report file', {
          file,
          error: readError instanceof Error ? readError.message : 'Unknown error',
        });
      }
    }

    return apiSuccess({ reports });
  } catch (error: unknown) {
    return apiError(
      'INTERNAL_ERROR',
      'Failed to list reports',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

// =============================================================================
// POST - Run evaluation
// =============================================================================

interface RunEvalRequest {
  dataset: EvalDataset;
  apiUrl?: string;
  apiKey?: string;
  includeAnswer?: boolean;
}

export async function POST(req: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return apiError('NOT_FOUND', 'Not found', 404);
  }

  try {
    await requireAdmin();
    const body = (await req.json()) as RunEvalRequest;

    if (
      !body.dataset?.name ||
      !Array.isArray(body.dataset?.queries) ||
      body.dataset.queries.length === 0
    ) {
      return apiError('BAD_REQUEST', 'Dataset must have a name and at least one query', 400);
    }

    const runner = new EvalRunner({
      apiBaseUrl: body.apiUrl || APP_URL,
      apiKey: body.apiKey,
      includeAnswer: body.includeAnswer ?? true,
    });

    const report = await runner.run(body.dataset);

    // Save report
    ensureResultsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${body.dataset.name.replace(/\s+/g, '-')}-${timestamp}.json`;
    writeFileSync(join(EVAL_RESULTS_DIR, filename), JSON.stringify(report, null, 2), 'utf-8');

    return apiSuccess({ filename, report });
  } catch (error: unknown) {
    return apiError(
      'INTERNAL_ERROR',
      'Failed to run evaluation',
      500,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
