/**
 * Agentic RAG Module
 *
 * Exports all agent-related functionality including:
 * - Query Router: Classifies queries into types
 * - ReAct Agent: Implements ReAct pattern for tool use
 * - Multi-Step Reasoner: Breaks complex queries into steps
 */

// Re-export from tools for convenience
export type { Tool, ToolResult } from '../tools/types';
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
// ReAct Agent
export {
  type AgentContext,
  createReActAgent,
  ReActAgent,
  type ReActConfig,
  type ReActResult,
  type ReActStep,
} from './react';
// Query Router
export {
  classifyQuery,
  createQueryRouter,
  type QueryClassification,
  QueryRouter,
  QueryType,
  type RouterConfig,
} from './router';
