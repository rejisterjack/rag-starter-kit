/**
 * Agentic RAG Module
 * 
 * Exports all agent-related functionality including:
 * - Query Router: Classifies queries into types
 * - ReAct Agent: Implements ReAct pattern for tool use
 * - Multi-Step Reasoner: Breaks complex queries into steps
 */

// Query Router
export {
  QueryRouter,
  QueryType,
  createQueryRouter,
  classifyQuery,
  type QueryClassification,
  type RouterConfig,
} from './router';

// ReAct Agent
export {
  ReActAgent,
  createReActAgent,
  type ReActStep,
  type ReActResult,
  type AgentContext,
  type ReActConfig,
} from './react';

// Multi-Step Reasoning
export {
  MultiStepReasoner,
  createMultiStepReasoner,
  type SubQuery,
  type SubQueryResult,
  type MultiStepResult,
  type MultiStepConfig,
  type MultiStepContext,
} from './multi-step';

// Re-export from tools for convenience
export { type Tool, type ToolResult } from '../tools/types';
