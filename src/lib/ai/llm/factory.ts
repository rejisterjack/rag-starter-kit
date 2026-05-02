/**
 * LLM Provider Factory
 * Factory function to create LLM provider instances based on configuration
 */

import { AnthropicProvider } from './anthropic';
import { FireworksProvider } from './fireworks';
import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';
import { OpenRouterProvider } from './openrouter';
import {
  type AnthropicConfig,
  type FireworksConfig,
  type LLMConfig,
  LLMError,
  type LLMProvider,
  type OllamaConfig,
  type OpenAIConfig,
  type OpenRouterConfig,
} from './types';

export { ANTHROPIC_MODELS, AnthropicProvider } from './anthropic';
export { FIREWORKS_FREE_MODELS, FireworksProvider } from './fireworks';
export { OLLAMA_MODELS, OllamaProvider } from './ollama';
export { OPENAI_MODELS, OpenAIProvider } from './openai';
export { OPENROUTER_FREE_MODELS, OpenRouterProvider } from './openrouter';
// Re-export all types and providers
export * from './types';

/**
 * Create an LLM provider based on configuration
 */
export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config as OpenAIConfig);
    case 'anthropic':
      return new AnthropicProvider(config as AnthropicConfig);
    case 'openrouter':
      return new OpenRouterProvider(config as OpenRouterConfig);
    case 'ollama':
      return new OllamaProvider(config as OllamaConfig);
    case 'fireworks':
      return new FireworksProvider(config as FireworksConfig);
    default:
      throw new LLMError(
        `Unknown provider: ${(config as { provider: string }).provider}`,
        'UNKNOWN_PROVIDER',
        false
      );
  }
}

/**
 * Create a provider from environment variables
 */
export function createProviderFromEnv(): LLMProvider {
  const provider = process.env.LLM_PROVIDER ?? 'openrouter';

  switch (provider) {
    case 'openai': {
      const config: OpenAIConfig = {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: process.env.DEFAULT_MODEL,
        fallbackModels: process.env.OPENAI_FALLBACK_MODELS?.split(','),
      };
      return new OpenAIProvider(config);
    }
    case 'anthropic': {
      const config: AnthropicConfig = {
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY,
        defaultModel: process.env.DEFAULT_MODEL,
      };
      return new AnthropicProvider(config);
    }
    case 'openrouter': {
      const config: OpenRouterConfig = {
        provider: 'openrouter',
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultModel: process.env.DEFAULT_MODEL,
        referer: process.env.OPENROUTER_REFERER,
        title: process.env.OPENROUTER_TITLE,
      };
      return new OpenRouterProvider(config);
    }
    case 'ollama': {
      const config: OllamaConfig = {
        provider: 'ollama',
        baseUrl: process.env.OLLAMA_BASE_URL,
        defaultModel: process.env.OLLAMA_CHAT_MODEL,
      };
      return new OllamaProvider(config);
    }
    case 'fireworks': {
      const config: FireworksConfig = {
        provider: 'fireworks',
        apiKey: process.env.FIREWORKS_API_KEY,
        defaultModel: process.env.DEFAULT_MODEL,
      };
      return new FireworksProvider(config);
    }
    default:
      throw new LLMError(`Unknown provider from env: ${provider}`, 'UNKNOWN_PROVIDER', false);
  }
}

/**
 * Get the default provider configuration
 */
export function getDefaultConfig(): LLMConfig {
  return {
    provider: 'openrouter',
    defaultModel: 'mistralai/mistral-7b-instruct:free',
  };
}
