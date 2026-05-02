/**
 * Admin Evaluation API
 *
 * GET  - List saved evaluation reports from the eval-results directory.
 * POST - Trigger a new evaluation run.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { NextResponse } from 'next/server';
import { EvalRunner } from '@/lib/eval/runner';
import type { EvalDataset, EvalReport } from '@/lib/eval/types';

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
  try {
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
      } catch (_error: unknown) {}
    }

    return NextResponse.json({ reports });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: 'Failed to list reports',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
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
  try {
    const body = (await req.json()) as RunEvalRequest;

    if (
      !body.dataset?.name ||
      !Array.isArray(body.dataset?.queries) ||
      body.dataset.queries.length === 0
    ) {
      return NextResponse.json(
        { error: 'Dataset must have a name and at least one query' },
        { status: 400 }
      );
    }

    const runner = new EvalRunner({
      apiBaseUrl: body.apiUrl || 'http://localhost:3000',
      apiKey: body.apiKey,
      includeAnswer: body.includeAnswer ?? true,
    });

    const report = await runner.run(body.dataset);

    // Save report
    ensureResultsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${body.dataset.name.replace(/\s+/g, '-')}-${timestamp}.json`;
    writeFileSync(join(EVAL_RESULTS_DIR, filename), JSON.stringify(report, null, 2), 'utf-8');

    return NextResponse.json({ filename, report });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: 'Failed to run evaluation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
