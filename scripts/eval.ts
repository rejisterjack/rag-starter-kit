#!/usr/bin/env tsx
/**
 * RAG Evaluation CLI
 *
 * Usage:
 *   pnpm eval --dataset ./eval-dataset.json [--output report.md] [--api-url http://localhost:3000] [--format markdown|json|table] [--no-answer]
 *
 * Reads an EvalDataset JSON file, runs queries against the RAG API,
 * and outputs a formatted report.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { EvalRunner } from '../src/lib/eval/runner';
import { formatReportAsJson, formatReportAsMarkdown, formatReportAsTable } from '../src/lib/eval/reporter';
import type { EvalDataset } from '../src/lib/eval/types';

// =============================================================================
// Argument parsing
// =============================================================================

interface CliArgs {
  dataset: string;
  output?: string;
  apiUrl: string;
  apiKey?: string;
  format: 'markdown' | 'json' | 'table';
  includeAnswer: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    dataset: '',
    apiUrl: 'http://localhost:3000',
    format: 'markdown',
    includeAnswer: true,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--dataset':
      case '-d':
        args.dataset = argv[++i];
        break;
      case '--output':
      case '-o':
        args.output = argv[++i];
        break;
      case '--api-url':
        args.apiUrl = argv[++i];
        break;
      case '--api-key':
        args.apiKey = argv[++i];
        break;
      case '--format':
        args.format = argv[++i] as CliArgs['format'];
        break;
      case '--no-answer':
        args.includeAnswer = false;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  if (!args.dataset) {
    console.error('Error: --dataset is required');
    printHelp();
    process.exit(1);
  }

  return args;
}

function printHelp(): void {
  console.log(`
RAG Evaluation CLI

Usage:
  pnpm eval --dataset <path> [options]

Options:
  --dataset, -d <path>       Path to eval dataset JSON file (required)
  --output, -o <path>        Output file path (default: stdout)
  --api-url <url>            Base URL of the RAG API (default: http://localhost:3000)
  --api-key <key>            API key for authentication
  --format <fmt>             Output format: markdown, json, table (default: markdown)
  --no-answer                Skip answer generation, only evaluate retrieval
  --help, -h                 Show this help message

Examples:
  pnpm eval --dataset ./eval-data.json
  pnpm eval -d ./eval-data.json -o report.md --format markdown
  pnpm eval -d ./eval-data.json --api-url http://localhost:3001 --no-answer
`);
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // Read dataset
  const datasetPath = resolve(args.dataset);
  if (!existsSync(datasetPath)) {
    console.error(`Error: Dataset file not found: ${datasetPath}`);
    process.exit(1);
  }

  let dataset: EvalDataset;
  try {
    const raw = readFileSync(datasetPath, 'utf-8');
    dataset = JSON.parse(raw) as EvalDataset;
  } catch (err) {
    console.error(`Error: Failed to read dataset: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  // Validate dataset
  if (!dataset.name || !Array.isArray(dataset.queries) || dataset.queries.length === 0) {
    console.error('Error: Dataset must have a name and at least one query');
    process.exit(1);
  }

  console.log(`Running evaluation: "${dataset.name}" (${dataset.queries.length} queries)`);
  console.log(`API: ${args.apiUrl}`);
  console.log(`Answer generation: ${args.includeAnswer ? 'enabled' : 'disabled'}`);
  console.log('');

  // Run evaluation
  const runner = new EvalRunner({
    apiBaseUrl: args.apiUrl,
    apiKey: args.apiKey,
    includeAnswer: args.includeAnswer,
  });

  const report = await runner.run(dataset);

  // Format output
  let output: string;
  switch (args.format) {
    case 'json':
      output = formatReportAsJson(report);
      break;
    case 'table':
      output = formatReportAsTable(report);
      break;
    case 'markdown':
    default:
      output = formatReportAsMarkdown(report);
      break;
  }

  // Write or print
  if (args.output) {
    const outputPath = resolve(args.output);
    const dir = resolve(outputPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(outputPath, output, 'utf-8');
    console.log(`Report written to: ${outputPath}`);
  } else {
    console.log(output);
  }

  // Save report to eval data directory for admin UI
  const evalDataDir = resolve(process.cwd(), 'eval-results');
  if (!existsSync(evalDataDir)) {
    mkdirSync(evalDataDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFileName = `${dataset.name.replace(/\s+/g, '-')}-${timestamp}.json`;
  const reportPath = resolve(evalDataDir, reportFileName);
  writeFileSync(reportPath, formatReportAsJson(report), 'utf-8');

  // Print summary
  console.log('');
  console.log(`  Successful: ${report.successfulQueries}/${report.totalQueries}`);
  console.log(`  Avg Precision: ${(report.avgRetrievalMetrics.precision * 100).toFixed(1)}%`);
  console.log(`  Avg Recall:    ${(report.avgRetrievalMetrics.recall * 100).toFixed(1)}%`);
  console.log(`  Avg F1:        ${(report.avgRetrievalMetrics.f1 * 100).toFixed(1)}%`);
  console.log(`  Avg Latency:   ${report.avgLatencyMs.toFixed(0)}ms`);

  if (report.failedQueries > 0) {
    console.log('');
    console.warn(`  WARNING: ${report.failedQueries} queries failed.`);
    for (const r of report.results.filter((r) => r.error)) {
      console.warn(`    - [${r.queryId}] ${r.error}`);
    }
  }
}

main().catch((err) => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});
