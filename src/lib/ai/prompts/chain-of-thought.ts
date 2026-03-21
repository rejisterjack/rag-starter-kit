/**
 * Chain-of-Thought (CoT) Prompting
 * Advanced prompting techniques for better reasoning and consistency
 */

import type { LLMMessage } from '@/lib/ai/llm/types';

/**
 * Chain-of-thought system prompt
 * Encourages the model to show its reasoning process
 */
export const CHAIN_OF_THOUGHT_PROMPT = `When answering complex questions, think step-by-step:
1. Analyze what information is needed from the context
2. Identify relevant sources and their relationships
3. Reason through the answer logically
4. Provide your final answer with citations

Show your reasoning clearly before giving the final answer.
Use this format:
<reasoning>
[Your step-by-step thinking process]
</reasoning>

<answer>
[Your final answer with citations]
</answer>`;

/**
 * Self-consistency check prompt
 * Asks the model to verify its own answer
 */
export const SELF_CONSISTENCY_PROMPT = `After providing your answer, verify it by checking:
1. Are all claims supported by the provided context? [Yes/No]
2. Are the citations accurate and properly formatted? [Yes/No]
3. Did you miss any relevant information from the context? [Yes/No]
4. Is the answer clear and directly addresses the question? [Yes/No]

If any answer is "No", revise your response accordingly.`;

/**
 * ReAct (Reasoning + Acting) prompt template
 * For complex multi-step reasoning
 */
export const REACT_PROMPT = `You are an AI assistant that solves problems through reasoning and action.
For complex queries, follow this pattern:

Thought: [Your reasoning about what to do next]
Action: [The action you take - either "search" or "answer"]
Observation: [Result of the action]
... (repeat Thought/Action/Observation as needed)

Final Answer: [Your comprehensive answer based on all observations]

Available actions:
- search: Look for more information in the context
- answer: Provide the final answer with citations`;

/**
 * Step-by-step verification prompt
 * Breaks reasoning into verifiable steps
 */
export const STEP_VERIFICATION_PROMPT = `For each step in your reasoning:
1. State what you're trying to establish
2. Cite the specific source(s) supporting this step
3. Explain the logical connection to the previous step
4. Note any assumptions or uncertainties

Number each step clearly and ensure the chain of reasoning is complete.`;

/**
 * Build a chain-of-thought prompt with context
 */
export function buildCoTPrompt(
  context: string,
  question: string,
  options: {
    includeVerification?: boolean;
    style?: 'simple' | 'detailed' | 'react';
  } = {}
): string {
  const { includeVerification = true, style = 'simple' } = options;

  let prompt = `You are a helpful AI assistant that thinks through problems carefully.\n\n`;

  // Add style-specific instructions
  switch (style) {
    case 'simple':
      prompt += CHAIN_OF_THOUGHT_PROMPT;
      break;
    case 'detailed':
      prompt += `${CHAIN_OF_THOUGHT_PROMPT}\n\n${STEP_VERIFICATION_PROMPT}`;
      break;
    case 'react':
      prompt += REACT_PROMPT;
      break;
  }

  if (includeVerification) {
    prompt += `\n\n${SELF_CONSISTENCY_PROMPT}`;
  }

  prompt += `\n\nContext:\n${context}\n\nQuestion: ${question}\n\nYour response:`;

  return prompt;
}

/**
 * Build messages with chain-of-thought prompting
 */
export function buildCoTMessages(
  context: string,
  question: string,
  history: LLMMessage[] = [],
  options: {
    includeVerification?: boolean;
    systemPrompt?: string;
  } = {}
): LLMMessage[] {
  const { includeVerification = false, systemPrompt } = options;

  let systemContent = systemPrompt ?? `You are a helpful AI assistant.`;
  systemContent += `\n\n${CHAIN_OF_THOUGHT_PROMPT}`;

  if (includeVerification) {
    systemContent += `\n\n${SELF_CONSISTENCY_PROMPT}`;
  }

  if (context) {
    systemContent += `\n\nUse this context to answer:\n${context}`;
  }

  return [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: question },
  ];
}

/**
 * Few-shot examples for chain-of-thought prompting
 */
export const COT_FEW_SHOT_EXAMPLES: LLMMessage[] = [
  {
    role: 'user',
    content: `Context:
[1] Document A: The company's revenue was $10M in 2022 and $15M in 2023.
[2] Document B: The company hired 50 new employees in 2023.

Question: What was the revenue growth percentage in 2023?`,
  },
  {
    role: 'assistant',
    content: `<reasoning>
1. I need to find the revenue figures for 2022 and 2023.
2. From Document A [1], revenue in 2022 was $10M and in 2023 was $15M.
3. To calculate growth percentage: ((New - Old) / Old) × 100
4. Calculation: ((15 - 10) / 10) × 100 = 50%
</reasoning>

<answer>
The revenue growth percentage in 2023 was 50% [1]. The revenue increased from $10M in 2022 to $15M in 2023.
</answer>`,
  },
  {
    role: 'user',
    content: `Context:
[1] The API rate limit is 1000 requests per minute.
[2] The API supports pagination with a default page size of 50.

Question: How many total items can I retrieve in one minute using pagination?`,
  },
  {
    role: 'assistant',
    content: `<reasoning>
1. I need to find the rate limit and page size.
2. From [1], the rate limit is 1000 requests per minute.
3. From [2], the default page size is 50 items per request.
4. Maximum items = rate limit × page size = 1000 × 50 = 50,000 items.
</reasoning>

<answer>
You can retrieve up to 50,000 items in one minute using pagination [1][2]. This is calculated as 1000 requests per minute × 50 items per page.
</answer>`,
  },
];

/**
 * Build few-shot CoT messages
 */
export function buildFewShotCoTMessages(
  context: string,
  question: string,
  customExamples?: LLMMessage[]
): LLMMessage[] {
  const systemPrompt = `You are a helpful AI assistant that thinks step-by-step. Follow the format shown in the examples below. Always cite your sources using [1], [2], etc.`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(customExamples ?? COT_FEW_SHOT_EXAMPLES),
    {
      role: 'user',
      content: `Context:\n${context}\n\nQuestion: ${question}`,
    },
  ];

  return messages;
}

/**
 * Extract reasoning from a CoT response
 */
export function extractReasoning(response: string): {
  reasoning: string;
  answer: string;
} {
  const reasoningMatch = response.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
  const answerMatch = response.match(/<answer>([\s\S]*?)<\/answer>/);

  return {
    reasoning: reasoningMatch ? reasoningMatch[1].trim() : '',
    answer: answerMatch ? answerMatch[1].trim() : response,
  };
}

/**
 * Simplified CoT for less complex queries
 */
export function buildSimplifiedCoTPrompt(context: string, question: string): string {
  return `Answer the following question by thinking step-by-step. Show your brief reasoning, then provide the final answer.

Context:
${context}

Question: ${question}

Step-by-step reasoning:
1. 
2. 
3. 

Final Answer:`;
}

/**
 * Tree of Thoughts prompting for complex multi-path reasoning
 */
export function buildTreeOfThoughtsPrompt(
  context: string,
  question: string,
  numPaths: number = 3
): string {
  return `Think through this problem by exploring ${numPaths} different approaches or perspectives.
For each approach:
1. State the approach
2. Show your reasoning
3. Evaluate the result

Then, synthesize the best answer from all approaches.

Context:
${context}

Question: ${question}

Approach 1:
[Reasoning and evaluation]

Approach 2:
[Reasoning and evaluation]

Approach 3:
[Reasoning and evaluation]

Synthesis - Best Answer:`;
}

/**
 * Self-reflection prompt for answer improvement
 */
export function buildSelfReflectionPrompt(originalAnswer: string, context: string): string {
  return `Review your previous answer and the context to identify potential improvements.

Original Answer:
${originalAnswer}

Context:
${context}

Reflection questions:
1. Did you miss any relevant information from the context?
2. Are there any inaccuracies or overstatements?
3. Could the explanation be clearer?
4. Are the citations complete and accurate?

Improved Answer (incorporating insights from reflection):`;
}

/**
 * Check if a CoT response is complete and well-formed
 */
export function validateCoTResponse(response: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!response.includes('<reasoning>')) {
    issues.push('Missing <reasoning> tags');
  }
  if (!response.includes('</reasoning>')) {
    issues.push('Missing </reasoning> tag');
  }
  if (!response.includes('<answer>')) {
    issues.push('Missing <answer> tags');
  }
  if (!response.includes('</answer>')) {
    issues.push('Missing </answer> tag');
  }

  // Check for citations in answer
  const answerMatch = response.match(/<answer>([\s\S]*?)<\/answer>/);
  if (answerMatch && !answerMatch[1].match(/\[\d+\]/)) {
    issues.push('Answer section missing citations');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
