/**
 * ReAct (Reasoning + Acting) Pattern Implementation
 *
 * Implements the ReAct pattern where the agent:
 * 1. Thinks: Reasons about what to do
 * 2. Acts: Executes a tool/action
 * 3. Observes: Processes the result
 * 4. Repeats until an answer is found
 *
 * Reference: https://arxiv.org/abs/2210.03629
 */

import { createProviderFromEnv } from '@/lib/ai/llm';
import type { Message, Source } from '@/types';
import type { Tool } from '../tools/types';
import type { AgentMemory } from './memory';
import { type AgentPlanner, createAgentPlanner, needsPlanning } from './planner';

// ============================================================================
// Types
// ============================================================================

export interface ReActStep {
  step: number;
  thought: string;
  action: string;
  actionInput: Record<string, unknown>;
  observation: string;
  timestamp: Date;
  status?: 'thinking' | 'acting' | 'observing' | 'completed' | 'error';
  error?: string;
}

export interface ReActResult {
  answer: string;
  steps: ReActStep[];
  sources: Source[];
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  latency: number;
  iterations: number;
  terminated: boolean;
  terminationReason?: string;
}

export interface AgentContext {
  workspaceId: string;
  userId: string;
  conversationId?: string;
  history?: Message[];
  maxSteps?: number;
  systemInstructions?: string;
  memory?: AgentMemory;
  enablePlanning?: boolean;
}

export interface ReActConfig {
  model?: string;
  temperature?: number;
  maxSteps?: number;
  maxTokens?: number;
  enableStreaming?: boolean;
  earlyTermination?: boolean;
  enableReflection?: boolean;
}

export interface StreamEvent {
  type: 'thought' | 'action' | 'observation' | 'answer' | 'error' | 'plan' | 'reflection';
  data: unknown;
}

// ============================================================================
// ReAct Prompt Templates
// ============================================================================

const REACT_SYSTEM_PROMPT = `You are a helpful AI assistant that uses tools to answer questions accurately.
Follow the ReAct pattern: Thought → Action → Observation → (repeat) → Final Answer

## Available Tools:
{tools}

## Instructions:
1. **Analyze** the user's question carefully and think step-by-step
2. **Reason** about what information you need and which tool to use
3. **Act** by calling the appropriate tool with the correct parameters
4. **Observe** the result and determine if you need more information
5. **Repeat** until you have enough information to provide a complete answer
6. **Answer** with a clear, comprehensive response that directly addresses the question

## Response Format:

When you need to use a tool, respond EXACTLY in this format:

Thought: [Your detailed reasoning about what to do and why]
Action: [tool_name]
Action Input: [JSON object with parameters]

After receiving an observation, analyze it and either use another tool or provide the final answer.

For the final answer, respond with:

Thought: [Your final reasoning summarizing what you learned]
Final Answer: [Your complete, well-structured answer to the user]

## Guidelines:
- Always cite sources when using retrieved information
- Be thorough but concise in your reasoning
- If you cannot find the answer after trying, say so clearly
- Use the most appropriate tool for each step
- Break complex tasks into multiple steps
- Reflect on your progress and adjust your approach if needed

## Tool Usage Tips:
{tool_tips}`;

const REFLECTION_PROMPT = `
Before providing your final answer, reflect on your work:
1. Did you fully answer the user's question?
2. Is there any information you're missing?
3. Should you verify any facts or calculations?
4. Is your answer clear and well-structured?

If you're confident, provide the Final Answer. If not, continue with another Thought/Action/Observation cycle.`;

// ============================================================================
// Tool Tips
// ============================================================================

const TOOL_TIPS: Record<string, string> = {
  calculator:
    'Use for mathematical calculations. Supports: +, -, *, /, ^, sqrt, log, sin, cos, etc.',
  web_search:
    'Use for current information, news, or facts not in documents. Returns top results with snippets.',
  document_search: 'Use to search through uploaded documents for specific information.',
  document_summary: 'Use to get a summary of a specific document.',
  code_executor:
    'Use for data processing, transformations, or complex calculations that need code.',
  current_time: 'Use to get the current date and time.',
};

// ============================================================================
// ReAct Agent
// ============================================================================

export class ReActAgent {
  private tools: Map<string, Tool>;
  private config: Required<ReActConfig>;
  private planner?: AgentPlanner;

  constructor(tools: Tool[] = [], config: ReActConfig = {}) {
    this.tools = new Map(tools.map((t) => [t.name, t]));
    this.config = {
      model: config.model ?? 'gpt-4o-mini',
      temperature: config.temperature ?? 0.1,
      maxSteps: config.maxSteps ?? 5,
      maxTokens: config.maxTokens ?? 2000,
      enableStreaming: config.enableStreaming ?? false,
      earlyTermination: config.earlyTermination ?? true,
      enableReflection: config.enableReflection ?? true,
    };

    if (this.config.enableReflection) {
      this.planner = createAgentPlanner({
        model: this.config.model,
        temperature: 0.2,
      });
    }
  }

  /**
   * Register a new tool
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): void {
    this.tools.delete(name);
  }

  /**
   * Get registered tools
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Execute the ReAct loop
   */
  async execute(query: string, context: AgentContext): Promise<ReActResult> {
    const startTime = Date.now();
    const steps: ReActStep[] = [];
    const sources: Source[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    const llm = createProviderFromEnv();
    const maxSteps = context.maxSteps ?? this.config.maxSteps;

    // Check if planning is needed
    let plan: string | undefined;
    if (context.enablePlanning !== false && this.planner && needsPlanning(query)) {
      const executionPlan = await this.planner.createPlan(query);
      plan = executionPlan.subtasks.map((st, i) => `${i + 1}. ${st.description}`).join('\n');
    }

    // Build the conversation
    const messages = this.buildMessages(query, context, plan);

    for (let step = 1; step <= maxSteps; step++) {
      // Generate thought and action
      const response = await llm.generate(messages, {
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      });

      totalPromptTokens += response.usage.promptTokens;
      totalCompletionTokens += response.usage.completionTokens;

      const content = response.content;

      // Parse the response
      const parsed = this.parseResponse(content);

      if (parsed.type === 'final') {
        // We have a final answer
        steps.push({
          step,
          thought: parsed.thought,
          action: 'final_answer',
          actionInput: {},
          observation: '',
          timestamp: new Date(),
          status: 'completed',
        });

        return {
          answer: parsed.answer,
          steps,
          sources: this.deduplicateSources(sources),
          tokensUsed: {
            prompt: totalPromptTokens,
            completion: totalCompletionTokens,
            total: totalPromptTokens + totalCompletionTokens,
          },
          latency: Date.now() - startTime,
          iterations: step,
          terminated: false,
        };
      }

      // Check for early termination
      if (this.config.earlyTermination && this.shouldTerminateEarly(parsed.thought, step)) {
        const finalAnswer = await this.generateFinalAnswer(messages, llm);

        steps.push({
          step,
          thought: `Early termination: ${parsed.thought}`,
          action: 'final_answer',
          actionInput: {},
          observation: '',
          timestamp: new Date(),
          status: 'completed',
        });

        return {
          answer: finalAnswer,
          steps,
          sources: this.deduplicateSources(sources),
          tokensUsed: {
            prompt: totalPromptTokens,
            completion: totalCompletionTokens,
            total: totalPromptTokens + totalCompletionTokens,
          },
          latency: Date.now() - startTime,
          iterations: step,
          terminated: true,
          terminationReason: 'Early termination based on confidence',
        };
      }

      // Execute the tool
      const toolResult = await this.executeTool(parsed.action, parsed.actionInput);

      // Collect sources from tool results
      if (toolResult.sources) {
        sources.push(...toolResult.sources);
      }

      // Record the step
      steps.push({
        step,
        thought: parsed.thought,
        action: parsed.action,
        actionInput: parsed.actionInput,
        observation: toolResult.output,
        timestamp: new Date(),
        status: toolResult.success ? 'completed' : 'error',
        error: toolResult.success ? undefined : toolResult.output,
      });

      // Add the observation to messages for the next iteration
      messages.push({
        role: 'assistant',
        content: content,
      });
      messages.push({
        role: 'user',
        content: `Observation: ${toolResult.output}\n\nContinue with your next thought and action, or provide the Final Answer if you have enough information.${this.config.enableReflection ? REFLECTION_PROMPT : ''}`,
      });
    }

    // Max steps reached without final answer - generate one last attempt
    const finalAttempt = await this.generateFinalAnswer(messages, llm);

    return {
      answer: finalAttempt,
      steps,
      sources: this.deduplicateSources(sources),
      tokensUsed: {
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
        total: totalPromptTokens + totalCompletionTokens,
      },
      latency: Date.now() - startTime,
      iterations: maxSteps,
      terminated: true,
      terminationReason: 'Max iterations reached',
    };
  }

  /**
   * Stream the ReAct execution
   */
  async *stream(query: string, context: AgentContext): AsyncGenerator<StreamEvent> {
    try {
      const maxSteps = context.maxSteps ?? this.config.maxSteps;
      const messages = this.buildMessages(query, context);

      // Check if planning is needed
      if (context.enablePlanning !== false && this.planner && needsPlanning(query)) {
        const executionPlan = await this.planner.createPlan(query);
        yield {
          type: 'plan',
          data: {
            goal: executionPlan.goal,
            strategy: executionPlan.strategy,
            subtasks: executionPlan.subtasks,
          },
        };
      }

      for (let step = 1; step <= maxSteps; step++) {
        const llm = createProviderFromEnv();
        const response = await llm.generate(messages, {
          model: this.config.model,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
        });

        const content = response.content;
        const parsed = this.parseResponse(content);

        // Yield thought
        yield {
          type: 'thought',
          data: { step, thought: parsed.thought },
        };

        if (parsed.type === 'final') {
          yield { type: 'answer', data: { answer: parsed.answer, step } };
          return;
        }

        // Yield action
        yield {
          type: 'action',
          data: {
            step,
            action: parsed.action,
            input: parsed.actionInput,
          },
        };

        // Execute tool
        const toolResult = await this.executeTool(parsed.action, parsed.actionInput);

        // Yield observation
        yield {
          type: 'observation',
          data: {
            step,
            observation: toolResult.output,
            success: toolResult.success,
          },
        };

        // Update messages
        messages.push({
          role: 'assistant',
          content: content,
        });
        messages.push({
          role: 'user',
          content: `Observation: ${toolResult.output}`,
        });
      }

      yield {
        type: 'error',
        data: { message: 'Max steps reached without final answer' },
      };
    } catch (error) {
      yield {
        type: 'error',
        data: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildMessages(
    query: string,
    context: AgentContext,
    plan?: string
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const toolDescriptions = Array.from(this.tools.values())
      .map((t) => `- ${t.name}: ${t.description}`)
      .join('\n');

    const toolTips = Array.from(this.tools.keys())
      .map((name) => (TOOL_TIPS[name] ? `- ${name}: ${TOOL_TIPS[name]}` : ''))
      .filter(Boolean)
      .join('\n');

    let systemPrompt = REACT_SYSTEM_PROMPT.replace(
      '{tools}',
      toolDescriptions || 'No tools available'
    ).replace('{tool_tips}', toolTips || 'No specific tips available.');

    if (context.systemInstructions) {
      systemPrompt += `\n\nAdditional Instructions: ${context.systemInstructions}`;
    }

    if (plan) {
      systemPrompt += `\n\nSuggested Plan:\n${plan}`;
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];

    // Add conversation history
    if (context.history && context.history.length > 0) {
      const recentHistory = context.history.slice(-6); // Last 6 messages
      for (const msg of recentHistory) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }

    // Add current query
    messages.push({
      role: 'user',
      content: `Question: ${query}\n\nThink step by step and use tools if needed.`,
    });

    return messages;
  }

  private parseResponse(content: string): {
    type: 'action' | 'final';
    thought: string;
    action: string;
    actionInput: Record<string, unknown>;
    answer: string;
  } {
    const thoughtMatch = content.match(/Thought:\s*(.+?)(?=Action:|Final Answer:|$)/is);
    const actionMatch = content.match(/Action:\s*(\w+)/i);
    const actionInputMatch = content.match(/Action Input:\s*(\{[\s\S]*?\})/i);
    const finalAnswerMatch = content.match(/Final Answer:\s*(.+)/is);

    const thought = thoughtMatch?.[1]?.trim() ?? 'No thought provided';

    if (finalAnswerMatch) {
      return {
        type: 'final',
        thought,
        action: '',
        actionInput: {},
        answer: finalAnswerMatch[1].trim(),
      };
    }

    if (actionMatch) {
      let actionInput: Record<string, unknown> = {};
      if (actionInputMatch) {
        try {
          actionInput = JSON.parse(actionInputMatch[1]);
        } catch {
          // Try to parse as plain string
          actionInput = { query: actionInputMatch[1].trim() };
        }
      }

      return {
        type: 'action',
        thought,
        action: actionMatch[1].trim(),
        actionInput,
        answer: '',
      };
    }

    // If no clear action or final answer, treat as final with full content
    return {
      type: 'final',
      thought,
      action: '',
      actionInput: {},
      answer: content.trim(),
    };
  }

  private async executeTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<{ output: string; success: boolean; sources?: Source[] }> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        output: `Error: Tool "${name}" not found. Available tools: ${Array.from(this.tools.keys()).join(', ')}`,
        success: false,
      };
    }

    try {
      const result = await tool.execute(input);

      return {
        output: result.success ? this.formatToolOutput(result.data) : `Error: ${result.error}`,
        success: result.success,
        sources: result.sources,
      };
    } catch (error) {
      return {
        output: `Error executing tool "${name}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
      };
    }
  }

  private formatToolOutput(data: unknown): string {
    if (typeof data === 'string') return data;
    if (typeof data === 'number') return String(data);
    if (typeof data === 'boolean') return String(data);
    if (data === null) return 'null';
    if (data === undefined) return 'undefined';
    return JSON.stringify(data, null, 2);
  }

  private deduplicateSources(sources: Source[]): Source[] {
    const seen = new Set<string>();
    return sources.filter((source) => {
      const key = `${source.metadata.documentId}-${source.metadata.chunkIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private shouldTerminateEarly(thought: string, currentStep: number): boolean {
    // Early termination heuristics
    const confidenceIndicators = [
      'i have enough information',
      'i can now answer',
      'the answer is clear',
      'based on the information gathered',
      'i am confident',
    ];

    const lowerThought = thought.toLowerCase();
    const hasConfidence = confidenceIndicators.some((indicator) =>
      lowerThought.includes(indicator)
    );

    // Require at least 2 steps and confidence indicator
    return currentStep >= 2 && hasConfidence;
  }

  private async generateFinalAnswer(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    llm: ReturnType<typeof createProviderFromEnv>
  ): Promise<string> {
    const finalMessages = [
      ...messages,
      {
        role: 'user' as const,
        content:
          'Based on all the information gathered, provide a comprehensive final answer to the original question. Be thorough and cite any sources used.',
      },
    ];

    const response = await llm.generate(finalMessages, {
      model: this.config.model,
      temperature: 0.3,
      maxTokens: this.config.maxTokens,
    });

    return response.content.trim();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createReActAgent(tools: Tool[] = [], config?: ReActConfig): ReActAgent {
  return new ReActAgent(tools, config);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a ReAct agent with default tools
 */
export async function createReActAgentWithDefaults(config?: ReActConfig): Promise<ReActAgent> {
  const { getAllTools } = await import('../tools');
  const tools = getAllTools();
  return new ReActAgent(tools, config);
}
