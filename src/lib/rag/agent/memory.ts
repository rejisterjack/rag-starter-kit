/**
 * Agent Memory System
 *
 * Provides persistent memory capabilities for agents including:
 * - Short-term memory: Conversation context and recent interactions
 * - Long-term memory: User preferences and persistent facts
 * - Working memory: Current task state and intermediate results
 */

import { prisma } from '@/lib/db';
import type { Message } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface MemoryEntry {
  id: string;
  key: string;
  value: unknown;
  category: MemoryCategory;
  importance: number; // 0-1, higher = more important
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date; // For short-term memories
  metadata?: Record<string, unknown>;
}

export type MemoryCategory = 'preference' | 'fact' | 'context' | 'task' | 'interaction';

export interface WorkingMemoryState {
  currentTask?: string;
  taskProgress: TaskProgress;
  intermediateResults: Record<string, unknown>;
  pendingActions: PendingAction[];
  contextVariables: Record<string, unknown>;
}

export interface TaskProgress {
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  completedSteps: number;
  totalSteps: number;
  currentStep?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface PendingAction {
  id: string;
  type: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
}

export interface MemoryQuery {
  category?: MemoryCategory;
  key?: string;
  minImportance?: number;
  since?: Date;
  until?: Date;
  limit?: number;
}

// ============================================================================
// In-Memory Storage (until database schema is updated)
// ============================================================================

// Global in-memory store for agent memory (userId_workspaceId -> entries)
const memoryStore = new Map<string, MemoryEntry[]>();

function getStoreKey(userId: string, workspaceId?: string): string {
  return `${userId}_${workspaceId ?? 'personal'}`;
}

function getUserMemory(userId: string, workspaceId?: string): MemoryEntry[] {
  const key = getStoreKey(userId, workspaceId);
  if (!memoryStore.has(key)) {
    memoryStore.set(key, []);
  }
  return memoryStore.get(key)!;
}

// ============================================================================
// Agent Memory Class
// ============================================================================

export class AgentMemory {
  private userId: string;
  private workspaceId?: string;
  private conversationId?: string;
  private workingMemory: WorkingMemoryState;

  constructor(userId: string, workspaceId?: string, conversationId?: string) {
    this.userId = userId;
    this.workspaceId = workspaceId;
    this.conversationId = conversationId;
    this.workingMemory = this.initializeWorkingMemory();
  }

  // ============================================================================
  // Short-term Memory (Conversation Context)
  // ============================================================================

  /**
   * Get recent conversation history
   */
  async getRecentConversation(limit: number = 10): Promise<Message[]> {
    if (!this.conversationId) {
      return [];
    }

    try {
      const messages = await prisma.message.findMany({
        where: {
          chatId: this.conversationId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      return messages.reverse().map((msg) => ({
        id: msg.id,
        role: msg.role as Message['role'],
        content: msg.content,
        createdAt: msg.createdAt,
        ...(msg.sources ? { sources: msg.sources as unknown as Message['sources'] } : {}),
      })) as Message[];
    } catch (_error) {
      return [];
    }
  }

  /**
   * Add a message to the conversation
   */
  async addMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    _metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.conversationId) {
      return;
    }

    try {
      const roleMap = { user: 'USER', assistant: 'ASSISTANT', system: 'SYSTEM' } as const;
      await prisma.message.create({
        data: {
          chatId: this.conversationId,
          role: roleMap[role],
          content,
        },
      });
    } catch (_error) {}
  }

  /**
   * Get conversation summary for context window optimization
   */
  async getConversationSummary(): Promise<string> {
    const messages = await this.getRecentConversation(20);

    if (messages.length === 0) {
      return '';
    }

    // Create a condensed summary
    const summary = messages
      .map((msg) => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        const content =
          msg.content.length > 200 ? `${msg.content.substring(0, 200)}...` : msg.content;
        return `${role}: ${content}`;
      })
      .join('\n');

    return summary;
  }

  // ============================================================================
  // Long-term Memory (User Preferences and Facts)
  // ============================================================================

  /**
   * Store a memory entry
   */
  async store(
    key: string,
    value: unknown,
    category: MemoryCategory,
    importance: number = 0.5,
    expiresIn?: number // milliseconds
  ): Promise<MemoryEntry> {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn) : undefined;

    const entry: MemoryEntry = {
      id: crypto.randomUUID(),
      key,
      value,
      category,
      importance,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt,
    };

    const userMemory = getUserMemory(this.userId, this.workspaceId);

    // Remove existing entry with same key
    const existingIndex = userMemory.findIndex((e) => e.key === key);
    if (existingIndex >= 0) {
      userMemory.splice(existingIndex, 1);
    }

    userMemory.push(entry);

    return entry;
  }

  /**
   * Retrieve a memory entry by key
   */
  async retrieve(key: string): Promise<MemoryEntry | null> {
    const userMemory = getUserMemory(this.userId, this.workspaceId);

    const entry = userMemory.find((e) => {
      if (e.key !== key) return false;
      if (e.expiresAt && e.expiresAt < new Date()) return false;
      return true;
    });

    return entry ?? null;
  }

  /**
   * Query memories with filters
   */
  async query(query: MemoryQuery = {}): Promise<MemoryEntry[]> {
    let results = getUserMemory(this.userId, this.workspaceId);

    // Filter by category
    if (query.category) {
      results = results.filter((e) => e.category === query.category);
    }

    // Filter by key (contains)
    if (query.key) {
      const keyLower = query.key.toLowerCase();
      results = results.filter((e) => e.key.toLowerCase().includes(keyLower));
    }

    // Filter by importance
    if (query.minImportance != null) {
      results = results.filter((e) => e.importance >= (query.minImportance ?? 0));
    }

    // Filter by date range
    if (query.since != null) {
      results = results.filter((e) => e.updatedAt >= query.since!);
    }
    if (query.until != null) {
      results = results.filter((e) => e.updatedAt <= query.until!);
    }

    // Filter out expired entries
    const now = new Date();
    results = results.filter((e) => !e.expiresAt || e.expiresAt > now);

    // Sort by importance (descending)
    results.sort((a, b) => b.importance - a.importance);

    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Delete a memory entry
   */
  async delete(key: string): Promise<boolean> {
    const userMemory = getUserMemory(this.userId, this.workspaceId);
    const index = userMemory.findIndex((e) => e.key === key);

    if (index >= 0) {
      userMemory.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<Record<string, unknown>> {
    const preferences = await this.query({
      category: 'preference',
      minImportance: 0.3,
    });

    return preferences.reduce(
      (acc, entry) => {
        acc[entry.key] = entry.value;
        return acc;
      },
      {} as Record<string, unknown>
    );
  }

  /**
   * Store a user preference
   */
  async setPreference(key: string, value: unknown, importance: number = 0.7): Promise<void> {
    await this.store(`preference:${key}`, value, 'preference', importance);
  }

  /**
   * Store a fact about the user or context
   */
  async storeFact(key: string, value: unknown, importance: number = 0.6): Promise<void> {
    await this.store(`fact:${key}`, value, 'fact', importance);
  }

  // ============================================================================
  // Working Memory (Current Task State)
  // ============================================================================

  private initializeWorkingMemory(): WorkingMemoryState {
    return {
      taskProgress: {
        taskId: crypto.randomUUID(),
        status: 'pending',
        completedSteps: 0,
        totalSteps: 0,
        startedAt: new Date(),
      },
      intermediateResults: {},
      pendingActions: [],
      contextVariables: {},
    };
  }

  /**
   * Get current working memory state
   */
  getWorkingMemory(): WorkingMemoryState {
    return { ...this.workingMemory };
  }

  /**
   * Set the current task
   */
  setCurrentTask(task: string, totalSteps: number = 0): void {
    this.workingMemory.currentTask = task;
    this.workingMemory.taskProgress = {
      taskId: crypto.randomUUID(),
      status: 'in_progress',
      completedSteps: 0,
      totalSteps,
      currentStep: undefined,
      startedAt: new Date(),
    };
    this.workingMemory.intermediateResults = {};
    this.workingMemory.pendingActions = [];
  }

  /**
   * Update task progress
   */
  updateTaskProgress(
    status: TaskProgress['status'],
    completedSteps?: number,
    currentStep?: string
  ): void {
    this.workingMemory.taskProgress.status = status;
    if (completedSteps !== undefined) {
      this.workingMemory.taskProgress.completedSteps = completedSteps;
    }
    if (currentStep !== undefined) {
      this.workingMemory.taskProgress.currentStep = currentStep;
    }
    if (status === 'completed' || status === 'failed') {
      this.workingMemory.taskProgress.completedAt = new Date();
    }
  }

  /**
   * Store intermediate result
   */
  storeIntermediateResult(key: string, value: unknown): void {
    this.workingMemory.intermediateResults[key] = value;
  }

  /**
   * Get intermediate result
   */
  getIntermediateResult(key: string): unknown {
    return this.workingMemory.intermediateResults[key];
  }

  /**
   * Add a pending action
   */
  addPendingAction(
    type: string,
    description: string,
    priority: PendingAction['priority'] = 'medium'
  ): string {
    const id = crypto.randomUUID();
    this.workingMemory.pendingActions.push({
      id,
      type,
      description,
      priority,
      createdAt: new Date(),
    });
    return id;
  }

  /**
   * Remove a pending action
   */
  removePendingAction(id: string): void {
    this.workingMemory.pendingActions = this.workingMemory.pendingActions.filter(
      (action) => action.id !== id
    );
  }

  /**
   * Get pending actions
   */
  getPendingActions(): PendingAction[] {
    return [...this.workingMemory.pendingActions];
  }

  /**
   * Set context variable
   */
  setContextVariable(key: string, value: unknown): void {
    this.workingMemory.contextVariables[key] = value;
  }

  /**
   * Get context variable
   */
  getContextVariable(key: string): unknown {
    return this.workingMemory.contextVariables[key];
  }

  /**
   * Clear working memory
   */
  clearWorkingMemory(): void {
    this.workingMemory = this.initializeWorkingMemory();
  }

  // ============================================================================
  // Memory Context Building
  // ============================================================================

  /**
   * Build a context string from relevant memories for the LLM
   */
  async buildMemoryContext(): Promise<string> {
    const parts: string[] = [];

    // Add user preferences
    const preferences = await this.getPreferences();
    if (Object.keys(preferences).length > 0) {
      parts.push('User Preferences:');
      for (const [key, value] of Object.entries(preferences)) {
        parts.push(`- ${key}: ${JSON.stringify(value)}`);
      }
    }

    // Add recent facts
    const recentFacts = await this.query({
      category: 'fact',
      since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      limit: 10,
    });

    if (recentFacts.length > 0) {
      parts.push('\nRelevant Facts:');
      for (const fact of recentFacts) {
        parts.push(`- ${fact.key}: ${JSON.stringify(fact.value)}`);
      }
    }

    // Add current task state
    if (this.workingMemory.currentTask) {
      parts.push('\nCurrent Task:');
      parts.push(`- Task: ${this.workingMemory.currentTask}`);
      parts.push(
        `- Progress: ${this.workingMemory.taskProgress.completedSteps}/${this.workingMemory.taskProgress.totalSteps} steps`
      );
      if (this.workingMemory.taskProgress.currentStep) {
        parts.push(`- Current Step: ${this.workingMemory.taskProgress.currentStep}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Clean up expired memories
   */
  async cleanupExpiredMemories(): Promise<number> {
    const userMemory = getUserMemory(this.userId, this.workspaceId);
    const now = new Date();
    const initialLength = userMemory.length;

    for (let i = userMemory.length - 1; i >= 0; i--) {
      if (userMemory[i]?.expiresAt && userMemory[i]?.expiresAt! < now) {
        userMemory.splice(i, 1);
      }
    }

    return initialLength - userMemory.length;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createAgentMemory(
  userId: string,
  workspaceId?: string,
  conversationId?: string
): AgentMemory {
  return new AgentMemory(userId, workspaceId, conversationId);
}

// ============================================================================
// Database Schema Helper (for reference)
// ============================================================================

/*
Prisma schema extension for agent memory:

model AgentMemory {
  id            String   @id @default(cuid())
  userId        String
  workspaceId   String   @default("")
  key           String
  value         String   // JSON string
  category      String   // preference, fact, context, task, interaction
  importance    Float    @default(0.5)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  expiresAt     DateTime?

  @@unique([userId, workspaceId, key])
  @@index([userId, workspaceId])
  @@index([category])
  @@index([expiresAt])
  @@map("agent_memories")
}
*/
