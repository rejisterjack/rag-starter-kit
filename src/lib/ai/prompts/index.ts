/**
 * Prompt Engineering Module
 * Export all prompt templates and chain-of-thought utilities
 */

// Chain of Thought
export {
  buildCoTMessages,
  buildCoTPrompt,
  buildFewShotCoTMessages,
  buildSelfReflectionPrompt,
  buildSimplifiedCoTPrompt,
  buildTreeOfThoughtsPrompt,
  CHAIN_OF_THOUGHT_PROMPT,
  COT_FEW_SHOT_EXAMPLES,
  extractReasoning,
  REACT_PROMPT,
  SELF_CONSISTENCY_PROMPT,
  STEP_VERIFICATION_PROMPT,
  validateCoTResponse,
} from './chain-of-thought';
// Templates
export {
  buildConversationSummarizationPrompt,
  buildQueryReformulationPrompt,
  buildRAGPrompt,
  buildSourceValidationPrompt,
  buildSummarizationPrompt,
  buildSystemPromptWithContext,
  CITATION_PROMPT,
  CONCISE_PROMPT,
  DETAILED_PROMPT,
  getStylePrompt,
  NO_CONTEXT_PROMPT,
  RAG_SYSTEM_PROMPT,
  RESPONSE_STYLE_TEMPLATES,
  type ResponseStyle,
  STEP_BY_STEP_PROMPT,
} from './templates';
