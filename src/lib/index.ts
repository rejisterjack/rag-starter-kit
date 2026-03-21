/**
 * Main Library Exports
 *
 * Central export point for all library modules.
 */

// AI & LLM - re-export with explicit naming to avoid ambiguity
export {
  buildRAGSystemPrompt,
  defaultAIConfig,
  estimateTokens,
  generateChatCompletion,
  generateEmbedding,
  generateEmbeddings,
  streamChatCompletion,
  truncateToTokenLimit,
} from './ai';
// AI Embeddings - re-export with explicit naming to avoid ambiguity
export {
  type BatchEmbeddingResult,
  type CachedEmbedding,
  createCachedProvider,
  createEmbeddingProvider,
  createEmbeddingProviderFromEnv,
  createOllamaProvider,
  createOpenAIProvider,
  createProviderWithFallback,
  type EmbeddingConfig,
  type EmbeddingProvider,
  getDefaultProvider,
  getModelDimensions,
  OLLAMA_MODELS,
  OllamaEmbeddingProvider,
  OPENAI_MODELS,
  OpenAIEmbeddingProvider,
} from './ai/embeddings';
// Analytics & Observability - re-export with explicit naming
export * from './analytics';
// Collaboration
export * from './collaboration';
// Database - re-export with explicit naming to avoid ambiguity
export { prisma } from './db';
// Experiments (A/B Testing)
export * from './experiments';
// Export
export * from './export';
// RAG (includes all agentic features)
export * from './rag';

// Real-time (WebSocket/SSE)
export * from './realtime';

// Security - re-export with explicit naming
export type { ApiKeyValidationResult, CreateApiKeyInput } from './security';
export {
  checkApiRateLimit,
  createApiKey,
  extractApiKey,
  getWorkspaceApiKeys,
  requireApiKey,
  revokeApiKey,
  validateApiKey,
} from './security';

// Utils
export * from './utils';
