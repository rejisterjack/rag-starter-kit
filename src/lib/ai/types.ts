/**
 * AI SDK Type Helpers
 *
 * Centralizes `as unknown as` casts that are needed due to version mismatches
 * in the AI SDK ecosystem (LanguageModelV3 vs LanguageModelV1).
 *
 * All such casts should go through these helpers so the workaround is
 * documented and isolated in a single file.
 */

/**
 * AI SDK providers return LanguageModelV3 but generateText/streamText expect LanguageModel (V1).
 * This is a known version mismatch in the AI SDK ecosystem.
 * Centralize the cast here so it's documented and isolated.
 */
export function asModel<T>(model: unknown): T {
  return model as T;
}

/**
 * Embedding model providers return types that don't directly satisfy the
 * `Parameters<typeof embed>[0]["model"]` constraint due to the same V3/V1 mismatch.
 * Use this helper to cast embedding models cleanly.
 */
export function asEmbeddingModel<T>(model: unknown): T {
  return model as T;
}
