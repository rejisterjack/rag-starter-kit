/**
 * Prompt Engineering Module
 * Export all prompt templates and chain-of-thought utilities
 */

// Templates
export {
  RAG_SYSTEM_PROMPT,
  CITATION_PROMPT,
  NO_CONTEXT_PROMPT,
  CONCISE_PROMPT,
  DETAILED_PROMPT,
  STEP_BY_STEP_PROMPT,
  RESPONSE_STYLE_TEMPLATES,
  buildRAGPrompt,
  buildSystemPromptWithContext,
  buildSummarizationPrompt,
  buildConversationSummarizationPrompt,
  buildQueryReformulationPrompt,
  buildSourceValidationPrompt,
  getStylePrompt,
  type ResponseStyle,
} from './templates';

// Chain of Thought
export {
  CHAIN_OF_THOUGHT_PROMPT,
  SELF_CONSISTENCY_PROMPT,
  REACT_PROMPT,
  STEP_VERIFICATION_PROMPT,
  COT_FEW_SHOT_EXAMPLES,
  buildCoTPrompt,
  buildCoTMessages,
  buildFewShotCoTMessages,
  buildSimplifiedCoTPrompt,
  buildTreeOfThoughtsPrompt,
  buildSelfReflectionPrompt,
  extractReasoning,
  validateCoTResponse,
} from './chain-of-thought';
