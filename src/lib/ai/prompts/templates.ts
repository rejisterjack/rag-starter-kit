/**
 * Prompt Templates for RAG
 * Centralized prompt templates for consistent LLM interactions
 */

/**
 * Base system prompt for RAG assistant
 */
export const RAG_SYSTEM_PROMPT = `You are a helpful AI assistant that answers questions based on the provided context documents. 
Your responses should be accurate, well-structured, and cite sources appropriately.

Key guidelines:
1. Base your answer ONLY on the provided context
2. Cite sources using [1], [2], etc. when referencing information
3. If the context doesn't contain the answer, clearly state that
4. Be concise but thorough in your explanations
5. Use bullet points or numbered lists when appropriate
6. Maintain a professional and helpful tone`;

/**
 * System prompt for citation-aware responses
 */
export const CITATION_PROMPT = `When using information from the context, cite your sources using the format [1], [2], etc.
Place citations immediately after the relevant information, not at the end of sentences.

Example:
- "According to the documentation [1], the API supports batch operations [2]."

If multiple sources support the same claim, cite all of them: "This feature is supported [1][2]."`;

/**
 * System prompt for when no context is available
 */
export const NO_CONTEXT_PROMPT = `No relevant documents were found for this query. 
Please let the user know that you don't have sufficient information to answer accurately.
Suggest that they:
1. Upload relevant documents
2. Rephrase their question
3. Try a more general query`;

/**
 * System prompt for concise answers
 */
export const CONCISE_PROMPT = `Provide concise answers while maintaining accuracy and completeness.
Aim for 2-4 sentences unless the question requires detailed explanation.
Focus on the most relevant information from the context.`;

/**
 * System prompt for detailed answers
 */
export const DETAILED_PROMPT = `Provide comprehensive and detailed answers.
Include relevant examples, explanations, and context where appropriate.
Structure your response with clear sections if needed.
Always cite your sources thoroughly.`;

/**
 * System prompt for step-by-step explanations
 */
export const STEP_BY_STEP_PROMPT = `Break down complex answers into clear, numbered steps.
Explain each step thoroughly and cite which source(s) support each step.
Use this format:
1. [Step description] - Source [1]
2. [Step description] - Source [2]
etc.`;

/**
 * Build a complete RAG prompt with context
 */
export function buildRAGPrompt(
  context: string,
  question: string,
  options: {
    includeCitations?: boolean;
    style?: 'concise' | 'detailed' | 'balanced';
    customInstructions?: string;
  } = {}
): string {
  const { includeCitations = true, style = 'balanced', customInstructions } = options;

  let systemPrompt = RAG_SYSTEM_PROMPT;

  // Add style-specific instructions
  switch (style) {
    case 'concise':
      systemPrompt += '\n\n' + CONCISE_PROMPT;
      break;
    case 'detailed':
      systemPrompt += '\n\n' + DETAILED_PROMPT;
      break;
  }

  // Add citation instructions
  if (includeCitations) {
    systemPrompt += '\n\n' + CITATION_PROMPT;
  }

  // Add custom instructions if provided
  if (customInstructions) {
    systemPrompt += '\n\nAdditional instructions:\n' + customInstructions;
  }

  // Build context section
  const contextSection = context
    ? `Context:\n${context}`
    : `Context:\nNo relevant documents found for this query.`;

  return `${systemPrompt}\n\n${contextSection}\n\nQuestion: ${question}\n\nAnswer:`;
}

/**
 * Build a system prompt with context (for use with chat messages)
 */
export function buildSystemPromptWithContext(
  context: string,
  options: {
    includeCitations?: boolean;
    style?: 'concise' | 'detailed' | 'balanced';
  } = {}
): string {
  const { includeCitations = true, style = 'balanced' } = options;

  let systemPrompt = RAG_SYSTEM_PROMPT;

  switch (style) {
    case 'concise':
      systemPrompt += '\n\n' + CONCISE_PROMPT;
      break;
    case 'detailed':
      systemPrompt += '\n\n' + DETAILED_PROMPT;
      break;
  }

  if (includeCitations) {
    systemPrompt += '\n\n' + CITATION_PROMPT;
  }

  if (context) {
    systemPrompt += `\n\nUse the following context to answer the user's questions:\n\n${context}`;
  } else {
    systemPrompt += `\n\n${NO_CONTEXT_PROMPT}`;
  }

  return systemPrompt;
}

/**
 * Build a prompt for document summarization
 */
export function buildSummarizationPrompt(
  documentContent: string,
  options: {
    maxLength?: number;
    focus?: string;
    style?: 'narrative' | 'bullet-points' | 'key-points';
  } = {}
): string {
  const { maxLength = 500, focus, style = 'key-points' } = options;

  let instructions = `Summarize the following document in approximately ${maxLength} words.`;

  switch (style) {
    case 'narrative':
      instructions += ' Provide a coherent narrative summary.';
      break;
    case 'bullet-points':
      instructions += ' Use bullet points for key information.';
      break;
    case 'key-points':
      instructions += ' Extract the key points and main takeaways.';
      break;
  }

  if (focus) {
    instructions += ` Focus on: ${focus}`;
  }

  return `${instructions}\n\nDocument:\n${documentContent}\n\nSummary:`;
}

/**
 * Build a prompt for conversation summarization (memory compression)
 */
export function buildConversationSummarizationPrompt(
  messages: Array<{ role: string; content: string }>,
  maxLength: number = 200
): string {
  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  return `Summarize the following conversation in ${maxLength} words or less. 
Extract key facts, decisions, and context that would be important for continuing the conversation.
Be specific about any requirements, preferences, or action items mentioned.

Conversation:
${conversationText}

Summary of key points and context:`;
}

/**
 * Build a prompt for query reformulation
 */
export function buildQueryReformulationPrompt(
  originalQuery: string,
  conversationHistory: string
): string {
  return `Given the following conversation history and the latest user query, 
reformulate the query to be self-contained and clear. Include relevant context from the conversation.

Conversation History:
${conversationHistory}

Latest Query: ${originalQuery}

Reformulated Query (standalone):`;
}

/**
 * Build a prompt for source validation
 */
export function buildSourceValidationPrompt(
  answer: string,
  sources: string
): string {
  return `Review the following answer and verify that all claims are supported by the provided sources.
Identify any unsupported claims or hallucinations.

Sources:
${sources}

Answer:
${answer}

Validation (list any unsupported claims or respond "All claims verified"):`;
}

/**
 * Template for different response styles
 */
export const RESPONSE_STYLE_TEMPLATES = {
  academic: `Respond in an academic tone. Use formal language, cite thoroughly, and acknowledge limitations or uncertainties.`,
  
  casual: `Respond in a friendly, conversational tone. Use simple language and analogies where helpful.`,
  
  technical: `Respond with technical precision. Use appropriate terminology, include specific details, and explain implementation considerations.`,
  
  executive: `Respond with executive summary style. Focus on key insights, implications, and actionable recommendations.`,
} as const;

export type ResponseStyle = keyof typeof RESPONSE_STYLE_TEMPLATES;

/**
 * Get style-specific system prompt addition
 */
export function getStylePrompt(style: ResponseStyle): string {
  return RESPONSE_STYLE_TEMPLATES[style] ?? RESPONSE_STYLE_TEMPLATES.casual;
}
