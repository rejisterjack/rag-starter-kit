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

// import { z } from 'zod';
import type { Message, Source } from '@/types';
import type { Tool } from '../tools/types';
import { createProviderFromEnv } from '@/lib/ai/llm';

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
}

export interface AgentContext {
  workspaceId: string;
  userId: string;
  conversationId?: string;
  history?: Message[];
  maxSteps?: number;
  systemInstructions?: string;
}

export interface ReActConfig {
  model?: string;
  temperature?: number;
  maxSteps?: number;
  maxTokens?: number;
}

// ============================================================================
// ReAct Prompt Templates
// ============================================================================

const REACT_SYSTEM_PROMPT = `You are a helpful AI assistant that can use tools to answer questions.
You should follow the ReAct pattern: Thought → Action → Observation → Answer

Available Tools:
{tools}

Instructions:
1. Analyze the user's question and think step-by-step
2. Decide if you need to use a tool or can answer directly
3. If using a tool, respond in this exact format:
   
   Thought: [Your reasoning about what to do]
   Action: [Tool name]
   Action Input: [JSON object with parameters]

4. After receiving an observation, analyze it and either:
   - Use another tool if needed
   - Provide the final answer

5. For the final answer, respond with:
   
   Thought: [Your final reasoning]
   Final Answer: [Your complete answer to the user]

Important:
- Always cite sources when using retrieved information
- Be thorough but concise
- If you cannot find the answer, say so clearly`;

// ============================================================================
// ReAct Agent
// ============================================================================

export class ReActAgent {
  private tools: Map<string, Tool>;
  private config: Required<ReActConfig>;

  constructor(tools: Tool[] = [], config: ReActConfig = {}) {
    this.tools = new Map(tools.map((t) => [t.name, t]));
    this.config = {
      model: config.model ?? 'gpt-4o-mini',
      temperature: config.temperature ?? 0.1,
      maxSteps: config.maxSteps ?? 5,
      maxTokens: config.maxTokens ?? 2000,
    };
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
    
    // Build the conversation
    const messages = this.buildMessages(query, context);

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
      });

      // Add the observation to messages for the next iteration
      messages.push({
        role: 'assistant',
        content: content,
      });
      messages.push({
        role: 'user',
        content: `Observation: ${toolResult.output}\n\nContinue with your next thought and action, or provide the Final Answer if you have enough information.`,
      });
    }

    // Max steps reached without final answer
    return {
      answer: 'I apologize, but I was unable to complete the task within the allowed number of steps. Please try rephrasing your question or breaking it into smaller parts.',
      steps,
      sources: this.deduplicateSources(sources),
      tokensUsed: {
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
        total: totalPromptTokens + totalCompletionTokens,
      },
      latency: Date.now() - startTime,
    };
  }

  /**
   * Stream the ReAct execution
   */
  async *stream(
    query: string,
    context: AgentContext
  ): AsyncGenerator<{
    type: 'thought' | 'action' | 'observation' | 'answer' | 'error';
    data: unknown;
  }> {
    try {
      const maxSteps = context.maxSteps ?? this.config.maxSteps;
      const messages = this.buildMessages(query, context);

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
        yield { type: 'thought', data: { step, thought: parsed.thought } };

        if (parsed.type === 'final') {
          yield { type: 'answer', data: { answer: parsed.answer } };
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
    context: AgentContext
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const toolDescriptions = Array.from(this.tools.values())
      .map((t) => `- ${t.name}: ${t.description}`)
      .join('\n');

    const systemPrompt = REACT_SYSTEM_PROMPT.replace('{tools}', toolDescriptions || 'No tools available');

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: context.systemInstructions
          ? `${systemPrompt}\n\nAdditional Instructions: ${context.systemInstructions}`
          : systemPrompt,
      },
    ];

    // Add conversation history
    if (context.history && context.history.length > 0) {
      const recentHistory = context.history.slice(-4);
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
        output: result.success
          ? this.formatToolOutput(result.data)
          : `Error: ${result.error}`,
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
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createReActAgent(tools: Tool[] = [], config?: ReActConfig): ReActAgent {
  return new ReActAgent(tools, config);
}
