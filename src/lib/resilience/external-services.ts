/**
 * Circuit breakers for external service calls
 *
 * Wraps each external dependency with a CircuitBreaker instance
 * from src/lib/utils/retry.ts. When a service fails repeatedly,
 * the circuit opens and subsequent calls fail fast without
 * hitting the external service.
 *
 * On open, the breaker auto-marks the corresponding feature as degraded
 * so the application can serve reduced responses instead of errors.
 */

import { markFeatureDegraded } from '@/lib/resilience/degradation';
import { CircuitBreaker } from '@/lib/utils/retry';

export const llmCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMaxCalls: 2,
  onOpen: () => {
    markFeatureDegraded('llm_generation', 60_000).catch(() => {});
  },
});

export const embeddingCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  halfOpenMaxCalls: 1,
  onOpen: () => {
    markFeatureDegraded('vector_search', 120_000).catch(() => {});
  },
});

export const storageCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
  halfOpenMaxCalls: 1,
  onOpen: () => {
    markFeatureDegraded('file_upload', 60_000).catch(() => {});
  },
});
