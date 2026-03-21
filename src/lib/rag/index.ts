/**
 * RAG Module
 * Export all RAG components including chain, memory, citations, error handling, and token budget
 */

// RAG Chain
export {
  createCustomRAGChain,
  createRAGChain,
  DefaultPromptBuilder,
  DefaultRetrievalEngine,
  type Message,
  type PromptBuilder,
  RAGChain,
  type RAGChainParams,
  type RAGResponse,
  type RetrievalEngine,
  type RetrievedChunk,
  type StreamEvent,
} from './chain';
// Citations
export {
  type Citation,
  CitationHandler,
  type CitationMatch,
  createCitationHandler,
  extractCitationNumbers,
  formatCitationForDisplay,
  getMostRelevantCitation,
  type HighlightedSource,
  removeCitations,
  replaceCitationsWithLinks,
  sortCitationsByScore,
  sourcesToChunks,
} from './citations';
// Error Handling
export {
  CircuitBreaker,
  createCircuitBreaker,
  createFallbackProvider,
  createResilientRAGChain,
  type ErrorContext,
  type ErrorHandler,
  type FallbackConfig,
  FallbackLLMProvider,
  ResilientRAGChain,
  ResilientRAGError,
  type ResilientRAGResponse,
  withRetry,
} from './error-handling';
// Memory
export {
  ConversationMemory,
  type ConversationSummary,
  createConversationMemory,
  extractKeyFacts,
  formatMessagesForContext,
  type MemoryConfig,
} from './memory';

// Token Budget
export {
  type AllocationResult,
  calculateTokenStats,
  createTokenBudgetManager,
  estimateMessageTokens,
  estimateTokens,
  getModelTokenLimits,
  MODEL_TOKEN_LIMITS,
  type ModelTokenLimits,
  type TokenAllocation,
  type TokenBudget,
  TokenBudgetManager,
  truncateToTokens,
  validateTokenConfig,
} from './token-budget';

// ============================================================================
// Agentic RAG Features
// ============================================================================

// Query Router
// ReAct Agent
// Multi-Step Reasoning
export {
  type AgentContext,
  classifyQuery,
  createMultiStepReasoner,
  createQueryRouter,
  createReActAgent,
  type MultiStepConfig,
  type MultiStepContext,
  MultiStepReasoner,
  type MultiStepResult,
  type QueryClassification,
  QueryRouter,
  QueryType,
  ReActAgent,
  type ReActConfig,
  type ReActResult,
  type ReActStep,
  type RouterConfig,
  type SubQuery,
  type SubQueryResult,
} from './agent';
// Conversation Branching
export {
  type BranchComparison,
  type ConversationBranch,
  compareBranches,
  type EditMessageResult,
  editMessage,
  forkConversation,
  getConversationTree,
  listBranches,
  mergeBranch,
  quickBranch,
  truncateConversation,
} from './conversation-branch';
// Tools
export {
  calculate,
  calculateBatch,
  calculatorTool,
  compareDocumentsTool,
  convert,
  createErrorResult,
  createSuccessResult,
  createTool,
  createToolRegistry,
  createWebSearchTool,
  currentTimeTool,
  DuckDuckGoProvider,
  documentMetadataTool,
  documentSummaryTool,
  documentTools,
  getAllTools,
  getDefaultWebSearchProvider,
  SerpAPIProvider,
  searchDocumentsTool,
  semanticSearchTool,
  TavilyProvider,
  type Tool,
  ToolRegistry,
  type ToolResult,
  type WebSearchOptions,
  type WebSearchProvider,
  type WebSearchResult,
} from './tools';

// ============================================================================
// Retrieval (re-exported for convenience)
// ============================================================================

export {
  aggregateByDocument,
  buildContext,
  deduplicateSources,
  formatSourceCitations,
  generateQueryEmbedding,
  getSourceDocumentStats,
  hybridSearch,
  rerankSources,
  retrieveSources,
  retrieveSourcesWithCache,
  searchSimilarChunks,
  searchSimilarChunksByDocuments,
} from './retrieval';
