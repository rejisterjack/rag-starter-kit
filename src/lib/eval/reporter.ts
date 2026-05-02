/**
 * Evaluation Reporter
 *
 * Formats EvalReport into JSON, Markdown, or terminal-friendly tables.
 */

import type { AnswerMetrics, EvalReport, RetrievalMetrics } from './types';

// =============================================================================
// Helpers
// =============================================================================

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function ms(value: number): string {
  return `${value.toFixed(0)}ms`;
}

function _formatRetrievalRow(m: RetrievalMetrics): string {
  return `${pct(m.precision)}  ${pct(m.recall)}  ${pct(m.f1)}  ${pct(m.mrr)}  ${pct(m.ndcg)}`;
}

function _formatAnswerRow(m: AnswerMetrics): string {
  return `${pct(m.faithfulness)}  ${pct(m.answerRelevance)}  ${pct(m.completeness)}`;
}

// =============================================================================
// JSON
// =============================================================================

export function formatReportAsJson(report: EvalReport): string {
  return JSON.stringify(report, null, 2);
}

// =============================================================================
// Markdown
// =============================================================================

export function formatReportAsMarkdown(report: EvalReport): string {
  const lines: string[] = [];

  lines.push(`# Evaluation Report: ${report.datasetName}`);
  lines.push('');
  lines.push(`**Timestamp:** ${report.timestamp}`);
  lines.push(
    `**Queries:** ${report.totalQueries} total, ${report.successfulQueries} succeeded, ${report.failedQueries} failed`
  );
  lines.push(`**Average Latency:** ${ms(report.avgLatencyMs)}`);
  lines.push('');

  // Summary metrics
  lines.push('## Average Retrieval Metrics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Precision | ${pct(report.avgRetrievalMetrics.precision)} |`);
  lines.push(`| Recall | ${pct(report.avgRetrievalMetrics.recall)} |`);
  lines.push(`| F1 | ${pct(report.avgRetrievalMetrics.f1)} |`);
  lines.push(`| MRR | ${pct(report.avgRetrievalMetrics.mrr)} |`);
  lines.push(`| NDCG | ${pct(report.avgRetrievalMetrics.ndcg)} |`);
  lines.push('');

  if (report.avgAnswerMetrics) {
    lines.push('## Average Answer Metrics');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Faithfulness | ${pct(report.avgAnswerMetrics.faithfulness)} |`);
    lines.push(`| Answer Relevance | ${pct(report.avgAnswerMetrics.answerRelevance)} |`);
    lines.push(`| Completeness | ${pct(report.avgAnswerMetrics.completeness)} |`);
    lines.push('');
  }

  // Per-query results
  lines.push('## Per-Query Results');
  lines.push('');

  const hasAnswerMetrics = report.results.some((r) => r.answerMetrics);

  // Header
  lines.push('| # | Query | Precision | Recall | F1 | MRR | NDCG | Latency |');
  if (hasAnswerMetrics) {
    lines[lines.length - 1] =
      '| # | Query | Precision | Recall | F1 | MRR | NDCG | Faithfulness | Relevance | Completeness | Latency |';
  }
  lines.push('|---|-------|-----------|--------|----|-----|------|----------|');
  if (hasAnswerMetrics) {
    lines[lines.length - 1] =
      '|---|-------|-----------|--------|----|-----|------|-------------|-----------|-------------|----------|';
  }

  report.results.forEach((r, i) => {
    const queryShort = r.query.length > 40 ? `${r.query.slice(0, 40)}...` : r.query;
    let row = `| ${i + 1} | ${queryShort} | ${pct(r.retrievalMetrics.precision)} | ${pct(r.retrievalMetrics.recall)} | ${pct(r.retrievalMetrics.f1)} | ${pct(r.retrievalMetrics.mrr)} | ${pct(r.retrievalMetrics.ndcg)} | ${ms(r.latencyMs)} |`;

    if (hasAnswerMetrics) {
      const am = r.answerMetrics ?? { faithfulness: 0, answerRelevance: 0, completeness: 0 };
      row = `| ${i + 1} | ${queryShort} | ${pct(r.retrievalMetrics.precision)} | ${pct(r.retrievalMetrics.recall)} | ${pct(r.retrievalMetrics.f1)} | ${pct(r.retrievalMetrics.mrr)} | ${pct(r.retrievalMetrics.ndcg)} | ${pct(am.faithfulness)} | ${pct(am.answerRelevance)} | ${pct(am.completeness)} | ${ms(r.latencyMs)} |`;
    }

    if (r.error) {
      row += ` **ERROR: ${r.error}**`;
    }
    lines.push(row);
  });

  lines.push('');
  return lines.join('\n');
}

// =============================================================================
// Terminal Table
// =============================================================================

export function formatReportAsTable(report: EvalReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`  Evaluation Report: ${report.datasetName}`);
  lines.push(`  Timestamp : ${report.timestamp}`);
  lines.push(
    `  Queries    : ${report.totalQueries} total (${report.successfulQueries} ok, ${report.failedQueries} failed)`
  );
  lines.push(`  Avg Latency: ${ms(report.avgLatencyMs)}`);
  lines.push('');

  // Average retrieval metrics
  lines.push('  ── Average Retrieval Metrics ──────────────────────────');
  lines.push(`  Precision : ${pct(report.avgRetrievalMetrics.precision).padStart(8)}`);
  lines.push(`  Recall    : ${pct(report.avgRetrievalMetrics.recall).padStart(8)}`);
  lines.push(`  F1        : ${pct(report.avgRetrievalMetrics.f1).padStart(8)}`);
  lines.push(`  MRR       : ${pct(report.avgRetrievalMetrics.mrr).padStart(8)}`);
  lines.push(`  NDCG      : ${pct(report.avgRetrievalMetrics.ndcg).padStart(8)}`);
  lines.push('');

  if (report.avgAnswerMetrics) {
    lines.push('  ── Average Answer Metrics ─────────────────────────────');
    lines.push(`  Faithfulness     : ${pct(report.avgAnswerMetrics.faithfulness).padStart(8)}`);
    lines.push(`  Answer Relevance : ${pct(report.avgAnswerMetrics.answerRelevance).padStart(8)}`);
    lines.push(`  Completeness     : ${pct(report.avgAnswerMetrics.completeness).padStart(8)}`);
    lines.push('');
  }

  // Per-query table
  lines.push('  ── Per-Query Results ──────────────────────────────────');
  lines.push('');

  const hasAnswerMetrics = report.results.some((r) => r.answerMetrics);

  if (hasAnswerMetrics) {
    lines.push(
      '  #   Query                               Prec    Recall  F1      MRR     NDCG    Faith   Relev   Compl   Latency'
    );
    lines.push(
      '  ─── ─────────────────────────────────── ─────── ─────── ─────── ─────── ─────── ─────── ─────── ─────── ───────'
    );
  } else {
    lines.push(
      '  #   Query                               Prec    Recall  F1      MRR     NDCG    Latency'
    );
    lines.push(
      '  ─── ─────────────────────────────────── ─────── ─────── ─────── ─────── ─────── ───────'
    );
  }

  report.results.forEach((r, i) => {
    const num = String(i + 1).padStart(3);
    const queryShort = r.query.length > 35 ? `${r.query.slice(0, 35)}...` : r.query;
    const qPad = queryShort.padEnd(37);

    if (hasAnswerMetrics) {
      const am = r.answerMetrics ?? { faithfulness: 0, answerRelevance: 0, completeness: 0 };
      lines.push(
        `  ${num} ${qPad} ${pct(r.retrievalMetrics.precision).padStart(7)} ${pct(r.retrievalMetrics.recall).padStart(7)} ${pct(r.retrievalMetrics.f1).padStart(7)} ${pct(r.retrievalMetrics.mrr).padStart(7)} ${pct(r.retrievalMetrics.ndcg).padStart(7)} ${pct(am.faithfulness).padStart(7)} ${pct(am.answerRelevance).padStart(7)} ${pct(am.completeness).padStart(7)} ${ms(r.latencyMs).padStart(7)}`
      );
    } else {
      lines.push(
        `  ${num} ${qPad} ${pct(r.retrievalMetrics.precision).padStart(7)} ${pct(r.retrievalMetrics.recall).padStart(7)} ${pct(r.retrievalMetrics.f1).padStart(7)} ${pct(r.retrievalMetrics.mrr).padStart(7)} ${pct(r.retrievalMetrics.ndcg).padStart(7)} ${ms(r.latencyMs).padStart(7)}`
      );
    }

    if (r.error) {
      lines.push(`      ERROR: ${r.error}`);
    }
  });

  lines.push('');
  return lines.join('\n');
}
