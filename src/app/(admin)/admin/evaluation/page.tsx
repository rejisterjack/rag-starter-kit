'use client';

import { BarChart3, CheckCircle2, Clock, Loader2, Play, RefreshCw, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { EvalReport } from '@/lib/eval/types';

// =============================================================================
// Types
// =============================================================================

interface SavedReport {
  filename: string;
  report: EvalReport;
}

// Sample dataset for quick evaluation
const SAMPLE_DATASET = {
  name: 'Quick Smoke Test',
  description: 'A small dataset for quick evaluation runs',
  queries: [
    {
      id: 'q1',
      query: 'What is this document about?',
      expectedDocuments: [],
    },
    {
      id: 'q2',
      query: 'Summarize the key points',
      expectedDocuments: [],
    },
    {
      id: 'q3',
      query: 'What are the main findings?',
      expectedDocuments: [],
    },
  ],
};

// =============================================================================
// Helpers
// =============================================================================

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function ms(value: number): string {
  return `${value.toFixed(0)}ms`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function scoreColor(value: number): string {
  if (value >= 0.8) return 'text-emerald-400';
  if (value >= 0.5) return 'text-amber-400';
  return 'text-red-400';
}

function statusBadge(successful: number, total: number) {
  if (successful === total) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        All Passed
      </span>
    );
  }
  if (successful === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-red-400">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-400">
      <Clock className="h-3 w-3" />
      {successful}/{total}
    </span>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function AdminEvaluationPage(): React.ReactElement {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/eval');
      if (!res.ok) throw new Error('Failed to fetch reports');
      const data = await res.json();
      setReports(data.reports ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleRunEval = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset: SAMPLE_DATASET,
          includeAnswer: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Evaluation failed');
      }

      // Refresh the report list
      await fetchReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run evaluation');
    } finally {
      setRunning(false);
    }
  };

  const toggleExpand = (filename: string) => {
    setExpandedReport(expandedReport === filename ? null : filename);
  };

  // Find the latest report for summary display
  const latestReport = reports.length > 0 ? reports[0] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Evaluation</h1>
          <p className="text-muted-foreground mt-2">Measure RAG retrieval and answer quality</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleRunEval} disabled={running}>
            {running ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {running ? 'Running...' : 'Run Evaluation'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Latest Report Summary */}
      {latestReport && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="glass backdrop-blur-xl border-white/5 shadow-2xl">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                Precision
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${scoreColor(latestReport.report.avgRetrievalMetrics.precision)}`}
              >
                {pct(latestReport.report.avgRetrievalMetrics.precision)}
              </p>
            </CardContent>
          </Card>
          <Card className="glass backdrop-blur-xl border-white/5 shadow-2xl">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                Recall
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${scoreColor(latestReport.report.avgRetrievalMetrics.recall)}`}
              >
                {pct(latestReport.report.avgRetrievalMetrics.recall)}
              </p>
            </CardContent>
          </Card>
          <Card className="glass backdrop-blur-xl border-white/5 shadow-2xl">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                F1 Score
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${scoreColor(latestReport.report.avgRetrievalMetrics.f1)}`}
              >
                {pct(latestReport.report.avgRetrievalMetrics.f1)}
              </p>
            </CardContent>
          </Card>
          <Card className="glass backdrop-blur-xl border-white/5 shadow-2xl">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                MRR
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${scoreColor(latestReport.report.avgRetrievalMetrics.mrr)}`}
              >
                {pct(latestReport.report.avgRetrievalMetrics.mrr)}
              </p>
            </CardContent>
          </Card>
          <Card className="glass backdrop-blur-xl border-white/5 shadow-2xl">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                Avg Latency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {ms(latestReport.report.avgLatencyMs)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report History */}
      <Card className="glass backdrop-blur-xl border-white/5 shadow-2xl">
        <CardHeader className="border-b border-border/40 pb-4 mb-4">
          <CardTitle className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
            Evaluation History
          </CardTitle>
          <CardDescription className="font-medium text-muted-foreground">
            Previous evaluation runs and their results
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <div className="mb-4 rounded-full bg-foreground/5 p-4 ring-1 ring-foreground/10">
                <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium">No evaluation runs yet</p>
              <p className="text-xs mt-1">
                Click &quot;Run Evaluation&quot; to start your first run
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/40 hover:bg-transparent">
                  <TableHead className="text-muted-foreground font-semibold">Dataset</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Date</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Status</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Precision</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Recall</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">F1</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">MRR</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">NDCG</TableHead>
                  <TableHead className="text-muted-foreground font-semibold">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map(({ filename, report }) => (
                  <>
                    <TableRow
                      key={filename}
                      className="border-border/20 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(filename)}
                    >
                      <TableCell>
                        <span className="text-sm font-medium text-foreground">
                          {report.datasetName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(report.timestamp)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {statusBadge(report.successfulQueries, report.totalQueries)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-sm font-medium ${scoreColor(report.avgRetrievalMetrics.precision)}`}
                        >
                          {pct(report.avgRetrievalMetrics.precision)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-sm font-medium ${scoreColor(report.avgRetrievalMetrics.recall)}`}
                        >
                          {pct(report.avgRetrievalMetrics.recall)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-sm font-medium ${scoreColor(report.avgRetrievalMetrics.f1)}`}
                        >
                          {pct(report.avgRetrievalMetrics.f1)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-sm font-medium ${scoreColor(report.avgRetrievalMetrics.mrr)}`}
                        >
                          {pct(report.avgRetrievalMetrics.mrr)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-sm font-medium ${scoreColor(report.avgRetrievalMetrics.ndcg)}`}
                        >
                          {pct(report.avgRetrievalMetrics.ndcg)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {ms(report.avgLatencyMs)}
                        </span>
                      </TableCell>
                    </TableRow>

                    {/* Expanded per-query results */}
                    {expandedReport === filename && (
                      <TableRow key={`${filename}-detail`} className="bg-white/[0.02]">
                        <TableCell colSpan={9} className="p-4">
                          <div className="space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                              Per-Query Breakdown
                            </p>
                            <Table>
                              <TableHeader>
                                <TableRow className="border-border/30 hover:bg-transparent">
                                  <TableHead className="text-xs text-muted-foreground">
                                    ID
                                  </TableHead>
                                  <TableHead className="text-xs text-muted-foreground">
                                    Query
                                  </TableHead>
                                  <TableHead className="text-xs text-muted-foreground">
                                    Precision
                                  </TableHead>
                                  <TableHead className="text-xs text-muted-foreground">
                                    Recall
                                  </TableHead>
                                  <TableHead className="text-xs text-muted-foreground">
                                    F1
                                  </TableHead>
                                  <TableHead className="text-xs text-muted-foreground">
                                    MRR
                                  </TableHead>
                                  <TableHead className="text-xs text-muted-foreground">
                                    NDCG
                                  </TableHead>
                                  <TableHead className="text-xs text-muted-foreground">
                                    Latency
                                  </TableHead>
                                  <TableHead className="text-xs text-muted-foreground">
                                    Retrieved
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {report.results.map((r) => (
                                  <TableRow
                                    key={r.queryId}
                                    className="border-border/10 hover:bg-transparent"
                                  >
                                    <TableCell className="text-xs text-muted-foreground font-mono">
                                      {r.queryId}
                                    </TableCell>
                                    <TableCell className="text-xs text-foreground max-w-[200px] truncate">
                                      {r.query}
                                    </TableCell>
                                    <TableCell
                                      className={`text-xs ${scoreColor(r.retrievalMetrics.precision)}`}
                                    >
                                      {pct(r.retrievalMetrics.precision)}
                                    </TableCell>
                                    <TableCell
                                      className={`text-xs ${scoreColor(r.retrievalMetrics.recall)}`}
                                    >
                                      {pct(r.retrievalMetrics.recall)}
                                    </TableCell>
                                    <TableCell
                                      className={`text-xs ${scoreColor(r.retrievalMetrics.f1)}`}
                                    >
                                      {pct(r.retrievalMetrics.f1)}
                                    </TableCell>
                                    <TableCell
                                      className={`text-xs ${scoreColor(r.retrievalMetrics.mrr)}`}
                                    >
                                      {pct(r.retrievalMetrics.mrr)}
                                    </TableCell>
                                    <TableCell
                                      className={`text-xs ${scoreColor(r.retrievalMetrics.ndcg)}`}
                                    >
                                      {pct(r.retrievalMetrics.ndcg)}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {ms(r.latencyMs)}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {r.retrievedDocumentIds.length}
                                      {r.error && (
                                        <span className="ml-2 text-red-400 text-[10px]">
                                          ERROR: {r.error}
                                        </span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>

                            {/* Answer metrics section */}
                            {report.avgAnswerMetrics && (
                              <div className="mt-4 pt-3 border-t border-border/20">
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                  Answer Quality
                                </p>
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <span className="text-xs text-muted-foreground">
                                      Faithfulness
                                    </span>
                                    <p
                                      className={`text-sm font-medium ${scoreColor(report.avgAnswerMetrics.faithfulness)}`}
                                    >
                                      {pct(report.avgAnswerMetrics.faithfulness)}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">
                                      Answer Relevance
                                    </span>
                                    <p
                                      className={`text-sm font-medium ${scoreColor(report.avgAnswerMetrics.answerRelevance)}`}
                                    >
                                      {pct(report.avgAnswerMetrics.answerRelevance)}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-xs text-muted-foreground">
                                      Completeness
                                    </span>
                                    <p
                                      className={`text-sm font-medium ${scoreColor(report.avgAnswerMetrics.completeness)}`}
                                    >
                                      {pct(report.avgAnswerMetrics.completeness)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
