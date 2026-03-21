/**
 * Agent Planning System
 *
 * Breaks complex tasks into subtasks, creates execution plans with dependencies,
 * tracks plan progress, and handles plan failures and replanning.
 */

import { z } from 'zod';
import { createProviderFromEnv } from '@/lib/ai/llm';

// ============================================================================
// Types
// ============================================================================

export interface Subtask {
  id: string;
  description: string;
  type: SubtaskType;
  dependencies: string[]; // IDs of subtasks that must complete before this one
  estimatedComplexity: 'low' | 'medium' | 'high';
  tool?: string; // Recommended tool for this subtask
  toolInput?: Record<string, unknown>;
  expectedOutput?: string;
  status: SubtaskStatus;
  result?: SubtaskResult;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export type SubtaskType =
  | 'retrieve' // Get information from documents
  | 'search' // Search for information
  | 'calculate' // Perform calculations
  | 'analyze' // Analyze data or text
  | 'summarize' // Summarize information
  | 'compare' // Compare items
  | 'transform' // Transform data format
  | 'validate' // Validate information
  | 'decide' // Make a decision
  | 'execute'; // Execute a tool

export type SubtaskStatus =
  | 'pending'
  | 'blocked'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface SubtaskResult {
  success: boolean;
  output: string;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionPlan {
  id: string;
  goal: string;
  subtasks: Subtask[];
  strategy: 'sequential' | 'parallel' | 'mixed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: PlanStatus;
  currentStep: number;
}

export type PlanStatus = 'draft' | 'ready' | 'executing' | 'completed' | 'failed' | 'replanning';

export interface PlanExecutionResult {
  success: boolean;
  plan: ExecutionPlan;
  completedSubtasks: Subtask[];
  failedSubtasks: Subtask[];
  finalOutput?: string;
  replanCount: number;
  executionTime: number;
}

export interface PlannerConfig {
  model?: string;
  temperature?: number;
  maxSubtasks?: number;
  enableReplanning?: boolean;
  maxReplanAttempts?: number;
  parallelThreshold?: number; // Max complexity score for parallel execution
}

// ============================================================================
// Subtask Schema for LLM
// ============================================================================

const SubtaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: z.enum([
    'retrieve',
    'search',
    'calculate',
    'analyze',
    'summarize',
    'compare',
    'transform',
    'validate',
    'decide',
    'execute',
  ]),
  dependencies: z.array(z.string()),
  estimatedComplexity: z.enum(['low', 'medium', 'high']),
  tool: z.string().optional(),
  toolInput: z.record(z.string(), z.unknown()).optional(),
  expectedOutput: z.string().optional(),
});

const PlanSchema = z.object({
  goal: z.string(),
  strategy: z.enum(['sequential', 'parallel', 'mixed']),
  subtasks: z.array(SubtaskSchema),
  reasoning: z.string(),
});

// ============================================================================
// Agent Planner
// ============================================================================

export class AgentPlanner {
  private config: Required<PlannerConfig>;

  constructor(config: PlannerConfig = {}) {
    this.config = {
      model: config.model ?? 'gpt-4o-mini',
      temperature: config.temperature ?? 0.2,
      maxSubtasks: config.maxSubtasks ?? 10,
      enableReplanning: config.enableReplanning ?? true,
      maxReplanAttempts: config.maxReplanAttempts ?? 3,
      parallelThreshold: config.parallelThreshold ?? 5,
    };
  }

  /**
   * Create an execution plan for a complex task
   */
  async createPlan(goal: string, context?: string): Promise<ExecutionPlan> {
    const llm = createProviderFromEnv();

    const prompt = `You are a task planning expert. Break down the following goal into a structured execution plan.

Goal: "${goal}"

${context ? `Context:\n${context}\n` : ''}

Create a plan with the following considerations:
1. Break the goal into small, actionable subtasks (max ${this.config.maxSubtasks})
2. Identify dependencies between subtasks
3. Assign appropriate types to each subtask
4. Estimate complexity for each subtask
5. Recommend tools where applicable
6. Choose an execution strategy (sequential, parallel, or mixed)

Available subtask types:
- retrieve: Get information from documents or knowledge base
- search: Search for information (web or documents)
- calculate: Perform mathematical calculations
- analyze: Analyze data, text, or patterns
- summarize: Summarize information
- compare: Compare multiple items or options
- transform: Transform data from one format to another
- validate: Validate information or check conditions
- decide: Make a decision based on available information
- execute: Execute a specific tool or action

Guidelines:
- Each subtask should have a unique ID (e.g., "task1", "task2")
- Dependencies should reference valid task IDs
- Keep descriptions clear and specific
- Consider what information each subtask needs from previous ones

Respond with a JSON object matching this structure:
{
  "goal": "restated goal",
  "strategy": "sequential|parallel|mixed",
  "subtasks": [
    {
      "id": "task1",
      "description": "specific action to take",
      "type": "retrieve",
      "dependencies": [],
      "estimatedComplexity": "low",
      "tool": "optional_tool_name",
      "toolInput": {},
      "expectedOutput": "what this subtask should produce"
    }
  ],
  "reasoning": "explanation of the plan structure"
}`;

    const response = await llm.generate(
      [
        { role: 'system', content: prompt },
        { role: 'user', content: `Create an execution plan for: "${goal}"` },
      ],
      {
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: 2000,
      }
    );

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = PlanSchema.parse(JSON.parse(jsonMatch[0]));

      // Create the execution plan
      const plan: ExecutionPlan = {
        id: crypto.randomUUID(),
        goal: parsed.goal,
        strategy: parsed.strategy,
        subtasks: parsed.subtasks.map((st) => ({
          ...st,
          status: st.dependencies.length === 0 ? 'ready' : 'blocked',
          createdAt: new Date(),
        })),
        createdAt: new Date(),
        status: 'ready',
        currentStep: 0,
      };

      // Validate dependencies
      this.validateDependencies(plan);

      return plan;
    } catch (_error) {
      // Fallback: create a simple sequential plan
      return this.createFallbackPlan(goal);
    }
  }

  /**
   * Execute a plan
   */
  async executePlan(
    plan: ExecutionPlan,
    executor: (subtask: Subtask) => Promise<SubtaskResult>
  ): Promise<PlanExecutionResult> {
    const startTime = Date.now();
    let replanCount = 0;

    plan.status = 'executing';
    plan.startedAt = new Date();

    while (plan.status === 'executing') {
      // Get ready subtasks
      const readySubtasks = this.getReadySubtasks(plan);

      if (readySubtasks.length === 0) {
        // Check if all subtasks are complete
        if (this.isPlanComplete(plan)) {
          plan.status = 'completed';
          plan.completedAt = new Date();
          break;
        }

        // Check for deadlock (no ready subtasks but not complete)
        if (this.hasDeadlock(plan)) {
          if (this.config.enableReplanning && replanCount < this.config.maxReplanAttempts) {
            plan = await this.replan(plan, 'Deadlock detected in dependencies');
            replanCount++;
            continue;
          } else {
            plan.status = 'failed';
            break;
          }
        }
      }

      // Execute ready subtasks
      if (plan.strategy === 'sequential' || readySubtasks.length === 1) {
        // Execute one at a time
        const subtask = readySubtasks[0];
        if (subtask) {
          await this.executeSubtask(subtask, executor);
          this.updateDependentStatuses(plan);
        }
      } else {
        // Execute in parallel (up to a limit)
        const batch = readySubtasks.slice(0, 3); // Max 3 parallel
        await Promise.all(batch.map((st) => this.executeSubtask(st, executor)));
        this.updateDependentStatuses(plan);
      }

      plan.currentStep++;
    }

    const completedSubtasks = plan.subtasks.filter((st) => st.status === 'completed');
    const failedSubtasks = plan.subtasks.filter((st) => st.status === 'failed');

    // Generate final output if plan completed successfully
    let finalOutput: string | undefined;
    if (plan.status === 'completed') {
      finalOutput = this.generateFinalOutput(plan);
    }

    return {
      success: plan.status === 'completed',
      plan,
      completedSubtasks,
      failedSubtasks,
      finalOutput,
      replanCount,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Stream plan execution
   */
  async *streamPlanExecution(
    plan: ExecutionPlan,
    executor: (subtask: Subtask) => Promise<SubtaskResult>
  ): AsyncGenerator<{
    type:
      | 'plan_start'
      | 'subtask_start'
      | 'subtask_complete'
      | 'subtask_failed'
      | 'plan_complete'
      | 'plan_failed'
      | 'replanning';
    data: unknown;
  }> {
    plan.status = 'executing';
    plan.startedAt = new Date();

    yield { type: 'plan_start', data: { planId: plan.id, subtaskCount: plan.subtasks.length } };

    while (plan.status === 'executing') {
      const readySubtasks = this.getReadySubtasks(plan);

      if (readySubtasks.length === 0) {
        if (this.isPlanComplete(plan)) {
          plan.status = 'completed';
          plan.completedAt = new Date();
          yield {
            type: 'plan_complete',
            data: {
              planId: plan.id,
              completedSubtasks: plan.subtasks.filter((st) => st.status === 'completed').length,
              finalOutput: this.generateFinalOutput(plan),
            },
          };
          break;
        }

        if (this.hasDeadlock(plan)) {
          plan.status = 'failed';
          yield {
            type: 'plan_failed',
            data: { planId: plan.id, reason: 'Deadlock detected' },
          };
          break;
        }
      }

      for (const subtask of readySubtasks.slice(0, 3)) {
        yield {
          type: 'subtask_start',
          data: {
            subtaskId: subtask.id,
            description: subtask.description,
            type: subtask.type,
          },
        };

        await this.executeSubtask(subtask, executor);

        if (subtask.status === 'completed') {
          yield {
            type: 'subtask_complete',
            data: {
              subtaskId: subtask.id,
              result: subtask.result,
            },
          };
        } else {
          yield {
            type: 'subtask_failed',
            data: {
              subtaskId: subtask.id,
              error: subtask.result?.error,
            },
          };
        }

        this.updateDependentStatuses(plan);
      }
    }
  }

  /**
   * Replan when the current plan fails
   */
  async replan(plan: ExecutionPlan, reason: string): Promise<ExecutionPlan> {
    plan.status = 'replanning';

    const completedResults = plan.subtasks
      .filter((st) => st.status === 'completed' && st.result)
      .map((st) => ({
        subtask: st.id,
        result: st.result?.output,
      }));

    const context = `Previous plan failed: ${reason}\n\nCompleted subtasks:\n${completedResults
      .map((r) => `- ${r.subtask}: ${r.result}`)
      .join('\n')}`;

    const newPlan = await this.createPlan(plan.goal, context);

    // Mark already completed subtasks in the new plan if they match
    for (const newSubtask of newPlan.subtasks) {
      const completed = plan.subtasks.find(
        (st) => st.status === 'completed' && st.description === newSubtask.description
      );
      if (completed) {
        newSubtask.status = 'completed';
        newSubtask.result = completed.result;
      }
    }

    newPlan.status = 'executing';
    return newPlan;
  }

  /**
   * Get the next subtask to execute
   */
  getNextSubtask(plan: ExecutionPlan): Subtask | null {
    const ready = this.getReadySubtasks(plan);
    return ready.length > 0 ? ready[0] : null;
  }

  /**
   * Get plan progress
   */
  getProgress(plan: ExecutionPlan): {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    inProgress: number;
    percentage: number;
  } {
    const total = plan.subtasks.length;
    const completed = plan.subtasks.filter((st) => st.status === 'completed').length;
    const failed = plan.subtasks.filter((st) => st.status === 'failed').length;
    const inProgress = plan.subtasks.filter((st) => st.status === 'in_progress').length;
    const pending = total - completed - failed - inProgress;

    return {
      total,
      completed,
      failed,
      pending,
      inProgress,
      percentage: Math.round(((completed + failed) / total) * 100),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateDependencies(plan: ExecutionPlan): void {
    const subtaskIds = new Set(plan.subtasks.map((st) => st.id));

    for (const subtask of plan.subtasks) {
      for (const depId of subtask.dependencies) {
        if (!subtaskIds.has(depId)) {
          // Remove invalid dependency
          subtask.dependencies = subtask.dependencies.filter((id) => id !== depId);
        }
      }
    }
  }

  private createFallbackPlan(goal: string): ExecutionPlan {
    return {
      id: crypto.randomUUID(),
      goal,
      strategy: 'sequential',
      subtasks: [
        {
          id: 'task1',
          description: goal,
          type: 'execute',
          dependencies: [],
          estimatedComplexity: 'medium',
          status: 'ready',
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
      status: 'ready',
      currentStep: 0,
    };
  }

  private getReadySubtasks(plan: ExecutionPlan): Subtask[] {
    return plan.subtasks.filter((st) => st.status === 'ready');
  }

  private async executeSubtask(
    subtask: Subtask,
    executor: (subtask: Subtask) => Promise<SubtaskResult>
  ): Promise<void> {
    subtask.status = 'in_progress';
    subtask.startedAt = new Date();

    try {
      const result = await executor(subtask);
      subtask.result = result;
      subtask.status = result.success ? 'completed' : 'failed';
    } catch (error) {
      subtask.result = {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      subtask.status = 'failed';
    }

    subtask.completedAt = new Date();
  }

  private updateDependentStatuses(plan: ExecutionPlan): void {
    for (const subtask of plan.subtasks) {
      if (subtask.status !== 'blocked') continue;

      const allDepsCompleted = subtask.dependencies.every((depId) => {
        const dep = plan.subtasks.find((st) => st.id === depId);
        return dep?.status === 'completed';
      });

      if (allDepsCompleted) {
        subtask.status = 'ready';
      }
    }
  }

  private isPlanComplete(plan: ExecutionPlan): boolean {
    return plan.subtasks.every(
      (st) => st.status === 'completed' || st.status === 'failed' || st.status === 'skipped'
    );
  }

  private hasDeadlock(plan: ExecutionPlan): boolean {
    const incomplete = plan.subtasks.filter(
      (st) => st.status !== 'completed' && st.status !== 'failed' && st.status !== 'skipped'
    );

    // Check if any incomplete task can progress
    for (const subtask of incomplete) {
      if (subtask.status === 'ready' || subtask.status === 'in_progress') {
        return false;
      }

      // Check if all dependencies are completed
      const depsCompleted = subtask.dependencies.every((depId) => {
        const dep = plan.subtasks.find((st) => st.id === depId);
        return dep?.status === 'completed';
      });

      if (depsCompleted) {
        return false;
      }
    }

    return true;
  }

  private generateFinalOutput(plan: ExecutionPlan): string {
    const completedResults = plan.subtasks
      .filter((st) => st.status === 'completed' && st.result)
      .map((st) => `[${st.description}]\n${st.result?.output}`);

    return completedResults.join('\n\n---\n\n');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createAgentPlanner(config?: PlannerConfig): AgentPlanner {
  return new AgentPlanner(config);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Estimate complexity of a task based on description
 */
export function estimateComplexity(description: string): 'low' | 'medium' | 'high' {
  const indicators = {
    high: ['multiple', 'complex', 'analyze', 'compare several', 'research', 'investigate'],
    medium: ['calculate', 'find', 'summarize', 'explain', 'describe'],
    low: ['simple', 'quick', 'basic', 'get', 'retrieve'],
  };

  const lowerDesc = description.toLowerCase();

  for (const indicator of indicators.high) {
    if (lowerDesc.includes(indicator)) return 'high';
  }

  for (const indicator of indicators.medium) {
    if (lowerDesc.includes(indicator)) return 'medium';
  }

  return 'low';
}

/**
 * Detect if a query needs planning (is complex enough)
 */
export function needsPlanning(query: string): boolean {
  const complexityIndicators = [
    'and then',
    'after that',
    'first',
    'second',
    'finally',
    'steps',
    'process',
    'workflow',
    'compare',
    'analyze',
    'calculate',
    'find all',
    'multiple',
    'several',
  ];

  const lowerQuery = query.toLowerCase();
  const indicatorCount = complexityIndicators.filter((ind) => lowerQuery.includes(ind)).length;

  return indicatorCount >= 2 || query.length > 150;
}
