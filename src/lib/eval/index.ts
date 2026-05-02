/**
 * Evaluation Framework
 *
 * Public API for the RAG evaluation library.
 */

export {
  averageAnswerMetrics,
  averageRetrievalMetrics,
  calculateAnswerMetrics,
  calculateF1,
  calculateMRR,
  calculateNDCG,
  calculatePrecision,
  calculateRecall,
  calculateRetrievalMetrics,
} from './metrics';
export {
  formatReportAsJson,
  formatReportAsMarkdown,
  formatReportAsTable,
} from './reporter';
export type { EvalRunnerConfig } from './runner';
export { EvalRunner } from './runner';
export type {
  AnswerMetrics,
  EvalDataset,
  EvalQuery,
  EvalReport,
  EvalResult,
  RetrievalMetrics,
} from './types';
