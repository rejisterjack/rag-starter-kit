/**
 * Dynamic Model Discovery
 *
 * Queries OpenRouter API to discover available free models, ranks them by quality,
 * probes for actual text output, and auto-recovers when models fail.
 *
 * All model selection is server-side. Consumers call getModelsForStreaming()
 * or getBestAvailableModel() — no frontend involvement.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText, type LanguageModel } from 'ai';
import { asModel } from '@/lib/ai/types';
import { APP_URL } from '@/lib/constants';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { modelHealthCache } from './model-health-cache';

// =============================================================================
// Types
// =============================================================================

export type AITask = 'chat' | 'fast' | 'hyde';

export interface ModelSelectionResult {
  modelsToTry: string[];
  primaryModel: string;
  discoveredAt: number;
  source: 'cache' | 'fresh' | 'fallback';
}

interface OpenRouterModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  architecture: {
    modality: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
  };
  top_provider?: {
    max_completion_tokens?: number;
    context_length?: number;
  };
  supported_parameters?: string[];
}

// =============================================================================
// Provider instances (cached at module level)
// =============================================================================

const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': APP_URL,
    'X-Title': 'RAG Starter Kit',
  },
});

const groq = process.env.GROQ_API_KEY
  ? createOpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' })
  : null;

const nvidia = process.env.NVIDIA_API_KEY
  ? createOpenAI({
      apiKey: process.env.NVIDIA_API_KEY,
      baseURL: 'https://integrate.api.nvidia.com/v1',
    })
  : null;

const cerebras = process.env.CEREBRAS_API_KEY
  ? createOpenAI({ apiKey: process.env.CEREBRAS_API_KEY, baseURL: 'https://api.cerebras.ai/v1' })
  : null;

const sambanova = process.env.SAMBANOVA_API_KEY
  ? createOpenAI({ apiKey: process.env.SAMBANOVA_API_KEY, baseURL: 'https://api.sambanova.ai/v1' })
  : null;

const mistral = process.env.MISTRAL_API_KEY
  ? createOpenAI({ apiKey: process.env.MISTRAL_API_KEY, baseURL: 'https://api.mistral.ai/v1' })
  : null;

// =============================================================================
// Priority provider chain (hardcoded, always preferred when API key exists)
// =============================================================================

const PROVIDER_PRIORITY_CHAIN: Array<{ id: string; provider: string; task?: AITask }> = [
  // Groq — ultra-fast LPU inference
  { id: 'groq/llama-3.3-70b-versatile', provider: 'groq' },
  { id: 'groq/meta-llama/llama-4-scout-17b-16e-instruct', provider: 'groq' },
  // SambaNova — DeepSeek V3.1 quality
  { id: 'sambanova/DeepSeek-V3.1', provider: 'sambanova' },
  { id: 'sambanova/Meta-Llama-3.3-70B-Instruct', provider: 'sambanova' },
  // NVIDIA NIM — Nemotron 70B
  { id: 'nvidia-nim/nvidia/llama-3.1-nemotron-70b-instruct', provider: 'nvidia-nim' },
  // Mistral — Large
  { id: 'mistral/mistral-large-latest', provider: 'mistral' },
  // Cerebras — fastest inference
  { id: 'cerebras/llama-4-scout-17b-16e-instruct', provider: 'cerebras' },
  { id: 'cerebras/llama3.1-8b', provider: 'cerebras', task: 'fast' },
];

const FAST_TASK_CHAIN = ['cerebras/llama3.1-8b', 'groq/llama-3.1-8b-instant'];

const HYDE_TASK_CHAIN = ['sambanova/DeepSeek-V3.1', 'groq/llama-3.3-70b-versatile'];

// Hardcoded fallback — used when OpenRouter API is unreachable
// Only models verified to return actual text content (not reasoning-only)
const HARDCODED_FALLBACK = [
  'liquid/lfm-2.5-1.2b-instruct:free',
  'baidu/cobuddy:free',
  'openai/gpt-oss-120b:free',
  'google/gemma-4-26b-a4b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
];

// Provider reliability bonus for scoring
const PROVIDER_BONUS: Record<string, number> = {
  google: 5,
  'meta-llama': 4,
  mistralai: 4,
  openai: 4,
  qwen: 3,
  deepseek: 3,
  nvidia: 3,
  liquid: 2,
  minimax: 2,
};

// =============================================================================
// Cache & Discovery State
// =============================================================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PROBE_TIMEOUT_MS = 5_000;

let cachedDiscoveredModels: string[] = [];
let cacheTimestamp = 0;
let isRefreshing = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

// =============================================================================
// Model Resolution (centralized — replaces all local getModel() functions)
// =============================================================================

/**
 * Resolve a model ID to a LanguageModel instance.
 * Routes by prefix to the correct provider.
 */
export function resolveModel(modelId: string): LanguageModel | null {
  if (modelId.startsWith('groq/')) {
    if (!groq) return null;
    return asModel<LanguageModel>(groq(modelId.slice(5)));
  }
  if (modelId.startsWith('nvidia-nim/')) {
    if (!nvidia) return null;
    return asModel<LanguageModel>(nvidia(modelId.slice(11)));
  }
  if (modelId.startsWith('cerebras/')) {
    if (!cerebras) return null;
    return asModel<LanguageModel>(cerebras(modelId.slice(9)));
  }
  if (modelId.startsWith('sambanova/')) {
    if (!sambanova) return null;
    return asModel<LanguageModel>(sambanova(modelId.slice(10)));
  }
  if (modelId.startsWith('mistral/')) {
    if (!mistral) return null;
    return asModel<LanguageModel>(mistral(modelId.slice(8)));
  }
  // Default: OpenRouter
  return asModel<LanguageModel>(openrouter.chat(modelId));
}

/**
 * Like resolveModel, but throws if the provider is not configured.
 */
export function resolveModelOrThrow(modelId: string): LanguageModel {
  const model = resolveModel(modelId);
  if (!model) {
    const prefix = modelId.split('/')[0];
    throw new Error(
      `Provider "${prefix}" is not configured. Set the corresponding API key environment variable.`
    );
  }
  return model;
}

// =============================================================================
// OpenRouter Discovery
// =============================================================================

/**
 * Fetch free models from OpenRouter API, filter and rank them.
 */
async function discoverOpenRouterModels(): Promise<string[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      logger.warn('OpenRouter models API returned non-200', { status: response.status });
      return [];
    }

    const data = await response.json();
    const models: OpenRouterModel[] = data.data || [];

    // Filter: free, text-only, reasonable context
    const candidates = models.filter((m) => {
      const promptPrice = Number.parseFloat(m.pricing?.prompt || '1');
      const completionPrice = Number.parseFloat(m.pricing?.completion || '1');
      if (promptPrice !== 0 || completionPrice !== 0) return false;
      if ((m.context_length || 0) < 4096) return false;

      // Exclude image/audio/video output models
      const outputModalities = m.architecture?.output_modalities || [];
      if (outputModalities.some((mod) => ['image', 'audio', 'video'].includes(mod))) return false;

      // Exclude thinking-only models (output modality is only "reasoning" or "text" with reasoning)
      const hasText = outputModalities.includes('text') || outputModalities.length === 0;
      if (!hasText) return false;

      // Exclude known thinking/reasoning model patterns that pass the modality check
      // but still primarily output reasoning tokens instead of content
      const id = m.id.toLowerCase();
      if (id.includes('thinking') || id.includes('reasoning') || id.includes('deepseek-r'))
        return false;
      if (id.includes('nemotron-3-super') || id.includes('nemotron-3-nano')) return false;
      if (id.includes('owl-alpha') || id.includes('trinity')) return false;
      if (id.includes('lfm-2.5-1.2b-thinking')) return false;

      return true;
    });

    // Score and rank
    const scored = candidates.map((m) => {
      const provider = m.id.split('/')[0] || '';
      const providerBonus = PROVIDER_BONUS[provider] || 1;
      const score =
        (m.context_length || 4096) * 0.3 +
        (m.top_provider?.max_completion_tokens || 4096) * 0.2 +
        providerBonus * 50000;
      return { id: m.id, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Probe top candidates to verify they return actual text content
    const verified = await probeModels(scored.slice(0, 15).map((s) => s.id));

    logger.info('Model discovery complete', {
      totalFree: candidates.length,
      probed: Math.min(15, scored.length),
      verified: verified.length,
      top3: verified.slice(0, 3),
    });

    return verified;
  } catch (err) {
    logger.warn('OpenRouter model discovery failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Probe models to verify they return actual text content (not just reasoning).
 */
async function probeModels(modelIds: string[]): Promise<string[]> {
  const verified: string[] = [];

  // Probe in parallel batches of 3 to be fast but not overwhelming
  for (let i = 0; i < modelIds.length; i += 3) {
    const batch = modelIds.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        const model = resolveModel(id);
        if (!model) throw new Error(`No provider for ${id}`);

        const result = await generateText({
          model: asModel<LanguageModel>(model),
          messages: [{ role: 'user', content: 'Say hello in one sentence.' }],
          maxTokens: 20,
          abortSignal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });

        // Verify the model returned actual text content, not just reasoning
        // Require at least 3 chars to filter out models that return whitespace
        if (!result.text || result.text.trim().length < 3) {
          throw new Error(`Model ${id} returned empty text (thinking-only?)`);
        }

        return id;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        verified.push(result.value);
        modelHealthCache.recordSuccess(result.value);
      } else {
        const id = batch[results.indexOf(result)];
        modelHealthCache.recordFailure(id);
      }
    }

    // If we already have enough verified models, stop probing
    if (verified.length >= 5) break;
  }

  return verified;
}

// =============================================================================
// Cache Management
// =============================================================================

function isCacheValid(): boolean {
  return cachedDiscoveredModels.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

/**
 * Refresh the model cache by discovering new models from OpenRouter.
 * Runs in background — never blocks user requests.
 */
export async function refreshDiscovery(): Promise<void> {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    const discovered = await discoverOpenRouterModels();
    if (discovered.length > 0) {
      cachedDiscoveredModels = discovered;
      cacheTimestamp = Date.now();
    }
  } finally {
    isRefreshing = false;
  }

  // Schedule next refresh
  if (!refreshTimer) {
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      refreshDiscovery().catch(() => {});
    }, CACHE_TTL_MS);
    refreshTimer.unref?.();
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Build the full model chain for a given task.
 * Merges: provider-priority → discovered OpenRouter → hardcoded fallback.
 */
async function buildModelChain(
  task?: AITask
): Promise<{ models: string[]; source: ModelSelectionResult['source'] }> {
  // Task-specific chains
  if (task === 'fast') {
    const fastModels = FAST_TASK_CHAIN.filter((id) => resolveModel(id) !== null);
    return { models: [...fastModels, ...HARDCODED_FALLBACK], source: 'cache' };
  }
  if (task === 'hyde') {
    const hydeModels = HYDE_TASK_CHAIN.filter((id) => resolveModel(id) !== null);
    return { models: [...hydeModels, ...HARDCODED_FALLBACK], source: 'cache' };
  }

  // Chat task — full chain
  // 1. Provider-priority models (only those with API keys)
  const providerModels = PROVIDER_PRIORITY_CHAIN.filter(
    (entry) => !entry.task || entry.task === task
  )
    .filter((entry) => resolveModel(entry.id) !== null)
    .map((entry) => entry.id);

  // 2. Discovered OpenRouter models (or trigger background discovery)
  let source: ModelSelectionResult['source'] = 'cache';
  let discoveredModels: string[];

  if (isCacheValid()) {
    discoveredModels = cachedDiscoveredModels;
    source = 'cache';
  } else {
    // Try discovery, but don't block — use stale cache or fallback
    if (cachedDiscoveredModels.length > 0) {
      discoveredModels = cachedDiscoveredModels;
      source = 'cache';
      // Trigger background refresh
      refreshDiscovery().catch(() => {});
    } else {
      // First run — do a blocking discovery attempt
      try {
        await refreshDiscovery();
        discoveredModels = cachedDiscoveredModels;
        source = 'fresh';
      } catch {
        discoveredModels = [];
        source = 'fallback';
      }
    }
  }

  // 3. Merge and dedup
  const allModels = [...new Set([...providerModels, ...discoveredModels, ...HARDCODED_FALLBACK])];

  return { models: allModels, source };
}

/**
 * Get the ordered list of models to try for streaming/generation.
 * Filters out known-unhealthy models via health cache.
 */
export async function getModelsForStreaming(task?: AITask): Promise<ModelSelectionResult> {
  const { models: rawChain, source } = await buildModelChain(task);
  const modelsToTry = modelHealthCache.getModelsToTry(rawChain);

  return {
    modelsToTry: modelsToTry.length > 0 ? modelsToTry : rawChain,
    primaryModel: modelsToTry[0] || rawChain[0] || HARDCODED_FALLBACK[0],
    discoveredAt: cacheTimestamp,
    source,
  };
}

/**
 * Get the single best available model for a task.
 * Fast — reads from cache, no probing.
 */
export async function getBestAvailableModel(task?: AITask): Promise<string> {
  const { modelsToTry } = await getModelsForStreaming(task);
  return modelsToTry[0] || HARDCODED_FALLBACK[0];
}

/**
 * Get discovery stats for monitoring/debugging.
 */
export function getDiscoveryStats() {
  return {
    cachedModelCount: cachedDiscoveredModels.length,
    cacheAge: cacheTimestamp ? Date.now() - cacheTimestamp : null,
    cacheTTL: CACHE_TTL_MS,
    isRefreshing,
    healthCache: modelHealthCache.getStats(),
    providers: {
      groq: groq !== null,
      nvidia: nvidia !== null,
      cerebras: cerebras !== null,
      sambanova: sambanova !== null,
      mistral: mistral !== null,
    },
  };
}
