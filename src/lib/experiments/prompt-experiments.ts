/**
 * A/B Testing for Prompts
 *
 * Supports running experiments with different prompt variants
 * and tracking their performance.
 */

import { createHash } from 'node:crypto';

// ============================================================================
// Types
// ============================================================================

export interface PromptVersion {
  id: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate?: string;
  temperature?: number;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  variants: PromptVersion[];
  trafficSplit: number[]; // Percentages for each variant (must sum to 1)
  startDate: Date;
  endDate?: Date;
  status: 'draft' | 'running' | 'paused' | 'completed';
}

export interface ExperimentMetrics {
  responseQuality?: number; // User rating or automated score
  latency?: number;
  tokenUsage?: number;
  retrievalAccuracy?: number;
  userSatisfaction?: number;
  customMetrics?: Record<string, number>;
}

export interface ExperimentResult {
  variantId: string;
  variantName: string;
  metrics: ExperimentMetrics;
  sampleSize: number;
}

// ============================================================================
// Prompt Experiment Manager
// ============================================================================

export class PromptExperimentManager {
  private activeExperiments: Map<string, Experiment> = new Map();

  /**
   * Register an experiment
   */
  registerExperiment(experiment: Experiment): void {
    if (experiment.variants.length !== experiment.trafficSplit.length) {
      throw new Error('Number of variants must match traffic split length');
    }

    const totalSplit = experiment.trafficSplit.reduce((a, b) => a + b, 0);
    if (Math.abs(totalSplit - 1) > 0.001) {
      throw new Error('Traffic split must sum to 1');
    }

    this.activeExperiments.set(experiment.id, experiment);
  }

  /**
   * Get prompt variant for a user
   * Uses consistent hashing to ensure same user always gets same variant
   */
  getPromptVariant(experimentId: string, userId: string): PromptVersion | null {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') {
      return null;
    }

    // Use consistent hashing for variant assignment
    const hash = createHash('md5').update(`${experimentId}:${userId}`).digest('hex');
    const hashValue = parseInt(hash.slice(0, 8), 16) / 0xffffffff;

    // Determine variant based on traffic split
    let cumulativeSplit = 0;
    for (let i = 0; i < experiment.variants.length; i++) {
      cumulativeSplit += experiment.trafficSplit[i];
      if (hashValue <= cumulativeSplit) {
        return experiment.variants[i];
      }
    }

    // Fallback to last variant
    return experiment.variants[experiment.variants.length - 1];
  }

  /**
   * Get variant by ID (for manual testing)
   */
  getVariantById(experimentId: string, variantId: string): PromptVersion | null {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment) return null;

    return experiment.variants.find((v) => v.id === variantId) ?? null;
  }

  /**
   * Track experiment result
   */
  async trackExperimentResult(
    experimentId: string,
    variantId: string,
    metrics: ExperimentMetrics,
    metadata?: {
      userId?: string;
      conversationId?: string;
      query?: string;
    }
  ): Promise<void> {
    // Note: experimentResult model not in schema - no-op
    void experimentId;
    void variantId;
    void metrics;
    void metadata;
  }

  /**
   * Get experiment results
   */
  async getExperimentResults(experimentId: string): Promise<ExperimentResult[]> {
    const experiment = this.activeExperiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    // Note: experimentResult model not in schema - returning empty array
    void experimentId;
    const results: Array<{
      variantId: string;
      responseQuality: number;
      latency: number;
      tokenUsage: number;
      retrievalAccuracy: number;
      userSatisfaction: number;
      customMetrics: Record<string, number>;
      userId: string | null;
      conversationId: string | null;
      query: string | null;
      createdAt: Date;
    }> = [];

    // Aggregate results by variant
    const variantResults = new Map<string, { metrics: ExperimentMetrics[]; count: number }>();

    for (const result of results) {
      const existing = variantResults.get(result.variantId) ?? {
        metrics: [],
        count: 0,
      };

      existing.metrics.push({
        responseQuality: result.responseQuality ?? undefined,
        latency: result.latency ?? undefined,
        tokenUsage: result.tokenUsage ?? undefined,
        retrievalAccuracy: result.retrievalAccuracy ?? undefined,
        userSatisfaction: result.userSatisfaction ?? undefined,
        customMetrics: (result.customMetrics as Record<string, number>) ?? undefined,
      });
      existing.count++;

      variantResults.set(result.variantId, existing);
    }

    return Array.from(variantResults.entries()).map(([variantId, data]) => {
      const variant = experiment.variants.find((v) => v.id === variantId);

      return {
        variantId,
        variantName: variant?.name ?? 'Unknown',
        metrics: this.aggregateMetrics(data.metrics),
        sampleSize: data.count,
      };
    });
  }

  /**
   * Compare experiment variants
   */
  async compareVariants(experimentId: string): Promise<
    Array<{
      variantId: string;
      variantName: string;
      metrics: ExperimentMetrics;
      sampleSize: number;
      confidence?: number;
      isWinner?: boolean;
    }>
  > {
    const results = await this.getExperimentResults(experimentId);

    if (results.length === 0) return [];

    // Find best performing variant based on composite score
    const scoredResults = results.map((r) => ({
      ...r,
      compositeScore: this.calculateCompositeScore(r.metrics),
    }));

    const maxScore = Math.max(...scoredResults.map((r) => r.compositeScore));

    return scoredResults.map((r) => ({
      variantId: r.variantId,
      variantName: r.variantName,
      metrics: r.metrics,
      sampleSize: r.sampleSize,
      isWinner: r.compositeScore === maxScore && r.sampleSize > 10,
    }));
  }

  /**
   * Stop an experiment
   */
  stopExperiment(experimentId: string, winnerVariantId?: string): void {
    const experiment = this.activeExperiments.get(experimentId);
    if (experiment) {
      experiment.status = 'completed';
      experiment.endDate = new Date();

      if (winnerVariantId) {
        // Store winner in metadata
        (experiment as Experiment & { winnerVariantId?: string }).winnerVariantId = winnerVariantId;
      }
    }
  }

  /**
   * List all active experiments
   */
  listActiveExperiments(): Experiment[] {
    return Array.from(this.activeExperiments.values()).filter((e) => e.status === 'running');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private aggregateMetrics(metrics: ExperimentMetrics[]): ExperimentMetrics {
    const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / (values.length || 1);

    const responseQualities = metrics
      .map((m) => m.responseQuality)
      .filter((v): v is number => v !== undefined);
    const latencies = metrics.map((m) => m.latency).filter((v): v is number => v !== undefined);
    const tokenUsages = metrics
      .map((m) => m.tokenUsage)
      .filter((v): v is number => v !== undefined);

    return {
      responseQuality: responseQualities.length > 0 ? avg(responseQualities) : undefined,
      latency: latencies.length > 0 ? avg(latencies) : undefined,
      tokenUsage: tokenUsages.length > 0 ? avg(tokenUsages) : undefined,
    };
  }

  private calculateCompositeScore(metrics: ExperimentMetrics): number {
    // Weighted composite score
    const weights = {
      responseQuality: 0.4,
      latency: 0.2, // Lower is better, so we invert
      tokenUsage: 0.1, // Lower is better, so we invert
      userSatisfaction: 0.3,
    };

    let score = 0;

    if (metrics.responseQuality !== undefined) {
      score += metrics.responseQuality * weights.responseQuality;
    }

    if (metrics.latency !== undefined) {
      // Normalize latency (assuming 10s is max acceptable)
      const normalizedLatency = Math.max(0, 1 - metrics.latency / 10000);
      score += normalizedLatency * weights.latency;
    }

    if (metrics.tokenUsage !== undefined) {
      // Normalize token usage (assuming 4k is max)
      const normalizedTokens = Math.max(0, 1 - metrics.tokenUsage / 4000);
      score += normalizedTokens * weights.tokenUsage;
    }

    if (metrics.userSatisfaction !== undefined) {
      score += metrics.userSatisfaction * weights.userSatisfaction;
    }

    return score;
  }
}

// ============================================================================
// Predefined Experiments
// ============================================================================

export const DEFAULT_EXPERIMENTS: Record<string, Experiment> = {
  'citation-style': {
    id: 'citation-style',
    name: 'Citation Style Experiment',
    description: 'Test different citation formats in responses',
    variants: [
      {
        id: 'bracket-numbers',
        name: 'Bracket Numbers',
        systemPrompt: `You are a helpful AI assistant. Cite sources using [1], [2], etc. 
Place citations immediately after the relevant information.`,
      },
      {
        id: 'superscript',
        name: 'Superscript',
        systemPrompt: `You are a helpful AI assistant. Cite sources using superscript numbers like ¹, ², etc.
Place citations immediately after the relevant information.`,
      },
      {
        id: 'inline-names',
        name: 'Inline Names',
        systemPrompt: `You are a helpful AI assistant. Cite sources by mentioning the document name inline,
like "According to [Document Name]..."`,
      },
    ],
    trafficSplit: [0.34, 0.33, 0.33],
    startDate: new Date(),
    status: 'draft',
  },
  'response-length': {
    id: 'response-length',
    name: 'Response Length Experiment',
    description: 'Test conciseness vs detailed responses',
    variants: [
      {
        id: 'concise',
        name: 'Concise',
        systemPrompt: `You are a helpful AI assistant. Provide concise answers.
Aim for 2-4 sentences unless the question requires detailed explanation.`,
        temperature: 0.3,
      },
      {
        id: 'detailed',
        name: 'Detailed',
        systemPrompt: `You are a helpful AI assistant. Provide comprehensive, detailed answers.
Include context, examples, and thorough explanations.`,
        temperature: 0.5,
      },
      {
        id: 'adaptive',
        name: 'Adaptive',
        systemPrompt: `You are a helpful AI assistant. Adapt your response length to the question:
- Simple questions: 1-2 sentences
- Complex questions: Detailed explanation
- Always cite sources appropriately`,
        temperature: 0.4,
      },
    ],
    trafficSplit: [0.33, 0.33, 0.34],
    startDate: new Date(),
    status: 'draft',
  },
};

// ============================================================================
// Factory Functions
// ============================================================================

let globalExperimentManager: PromptExperimentManager | null = null;

export function getExperimentManager(): PromptExperimentManager {
  if (!globalExperimentManager) {
    globalExperimentManager = new PromptExperimentManager();

    // Register default experiments
    for (const experiment of Object.values(DEFAULT_EXPERIMENTS)) {
      globalExperimentManager.registerExperiment(experiment);
    }
  }
  return globalExperimentManager;
}

/**
 * Get prompt variant for current request
 * Convenience function that uses the global manager
 */
export function getPromptVariant(experiment: string, userId: string): PromptVersion | null {
  return getExperimentManager().getPromptVariant(experiment, userId);
}

/**
 * Track experiment result
 * Convenience function that uses the global manager
 */
export async function trackExperimentResult(
  experiment: string,
  variant: string,
  metrics: ExperimentMetrics,
  metadata?: { userId?: string; conversationId?: string; query?: string }
): Promise<void> {
  return getExperimentManager().trackExperimentResult(experiment, variant, metrics, metadata);
}

// ============================================================================
// Export
// ============================================================================

// Types are already exported above
