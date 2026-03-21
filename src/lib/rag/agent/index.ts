/**
 * Agentic RAG Module
 *
 * Exports all agent-related functionality including:
 * - Query Router: Classifies queries into types
 * - ReAct Agent: Implements ReAct pattern for tool use
 * - Multi-Step Reasoner: Breaks complex queries into steps
 * - Agent Memory: Persistent memory for conversations and user data
 * - Agent Planner: Task planning and execution management
 */

// Re-export from tools for convenience
export type { Tool, ToolResult } from '../tools/types';
// Agent Memory
export {
  AgentMemory,
  createAgentMemory,
  type MemoryCategory,
  type MemoryEntry,
  type MemoryQuery,
  type PendingAction,
  type TaskProgress,
  type WorkingMemoryState,
} from './memory';
// Multi-Step Reasoning
export {
  createMultiStepReasoner,
  type MultiStepConfig,
  type MultiStepContext,
  MultiStepReasoner,
  type MultiStepResult,
  type SubQuery,
  type SubQueryResult,
} from './multi-step';
// Agent Planner
export {
  AgentPlanner,
  createAgentPlanner,
  estimateComplexity,
  needsPlanning,
  type ExecutionPlan,
  type PlanExecutionResult,
  type PlannerConfig,
  type PlanStatus,
  type Subtask,
  type SubtaskResult,
  type SubtaskStatus,
  type SubtaskType,
} from './planner';
// ReAct Agent
export {
  type AgentContext,
  createReActAgent,
  createReActAgentWithDefaults,
  ReActAgent,
  type ReActConfig,
  type ReActResult,
  type ReActStep,
  type StreamEvent,
} from './react';
// Query Router
export {
  classifyQuery,
  createQueryRouter,
  type QueryClassification,
  QueryRouter,
  QueryType,
  type RouterConfig,
  type SimpleMessage,
} from './router';
