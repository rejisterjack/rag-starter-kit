/**
 * RAG Module
 * Export all RAG components including chain, memory, citations, error handling, and token budget
 */

// RAG Chain
export {
  RAGChain,
  DefaultPromptBuilder,
  DefaultRetrievalEngine,
  createRAGChain,
  createCustomRAGChain,
  type RetrievedChunk,
  type Message,
  type RAGResponse,
  type StreamEvent,
  type RAGChainParams,
  type PromptBuilder,
  type RetrievalEngine,
} from './chain';

// Memory
export {
  ConversationMemory,
  createConversationMemory,
  formatMessagesForContext,
  extractKeyFacts,
  type MemoryConfig,
  type ConversationSummary,
} from './memory';

// Citations
export {
  CitationHandler,
  createCitationHandler,
  sourcesToChunks,
  extractCitationNumbers,
  removeCitations,
  replaceCitationsWithLinks,
  sortCitationsByScore,
  getMostRelevantCitation,
  formatCitationForDisplay,
  type Citation,
  type HighlightedSource,
  type CitationMatch,
} from './citations';

// Error Handling
export {
  ResilientRAGChain,
  FallbackLLMProvider,
  CircuitBreaker,
  ResilientRAGError,
  withRetry,
  createResilientRAGChain,
  createFallbackProvider,
  createCircuitBreaker,
  type FallbackConfig,
  type ResilientRAGResponse,
  type ErrorContext,
  type ErrorHandler,
} from './error-handling';

// Token Budget
export {
  TokenBudgetManager,
  createTokenBudgetManager,
  estimateTokens,
  estimateMessageTokens,
  truncateToTokens,
  getModelTokenLimits,
  validateTokenConfig,
  calculateTokenStats,
  MODEL_TOKEN_LIMITS,
  type TokenAllocation,
  type TokenBudget,
  type AllocationResult,
  type ModelTokenLimits,
} from './token-budget';

// ============================================================================
// Agentic RAG Features
// ============================================================================

// Query Router
export {
  QueryRouter,
  QueryType,
  createQueryRouter,
  classifyQuery,
  type QueryClassification,
  type RouterConfig,
} from './agent';

// ReAct Agent
export {
  ReActAgent,
  createReActAgent,
  type ReActStep,
  type ReActResult,
  type AgentContext,
  type ReActConfig,
} from './agent';

// Multi-Step Reasoning
export {
  MultiStepReasoner,
  createMultiStepReasoner,
  type SubQuery,
  type SubQueryResult,
  type MultiStepResult,
  type MultiStepConfig,
  type MultiStepContext,
} from './agent';

// Tools
export {
  type Tool,
  type ToolResult,
  ToolRegistry,
  createTool,
  createSuccessResult,
  createErrorResult,
  calculatorTool,
  calculate,
  convert,
  calculateBatch,
  webSearchTool,
  createWebSearchTool,
  createWebSearchToolFromEnv,
  createWebSearchProviderFromEnv,
  type WebSearchProvider,
  type WebSearchResult,
  type WebSearchOptions,
  TavilyProvider,
  SerpAPIProvider,
  DuckDuckGoProvider,
  MockWebSearchProvider,
  searchDocumentsTool,
  documentSummaryTool,
  documentMetadataTool,
  semanticSearchTool,
  compareDocumentsTool,
  documentTools,
  currentTimeTool,
  getAllTools,
  createToolRegistry,
} from './tools';

// Conversation Branching
export {
  forkConversation,
  quickBranch,
  editMessage,
  truncateConversation,
  compareBranches,
  listBranches,
  getConversationTree,
  mergeBranch,
  type ConversationBranch,
  type BranchComparison,
  type EditMessageResult,
} from './conversation-branch';

// ============================================================================
// Retrieval (re-exported for convenience)
// ============================================================================

export {
  generateQueryEmbedding,
  searchSimilarChunks,
  searchSimilarChunksByDocuments,
  retrieveSources,
  retrieveSourcesWithCache,
  buildContext,
  formatSourceCitations,
  rerankSources,
  deduplicateSources,
  aggregateByDocument,
  getSourceDocumentStats,
  hybridSearch,
} from './retrieval';
