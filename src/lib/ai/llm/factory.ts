/**
 * LLM Provider Factory
 * Factory function to create LLM provider instances based on configuration
 */

import { OpenAIProvider } from './openai';
import { OllamaProvider } from './ollama';
import {
  type LLMProvider,
  type LLMConfig,
  type OpenAIConfig,
  type OllamaConfig,
  LLMError,
} from './types';

// Re-export all types and providers
export * from './types';
export { OpenAIProvider, OPENAI_MODELS } from './openai';
export { OllamaProvider, OLLAMA_MODELS } from './ollama';

/**
 * Create an LLM provider based on configuration
 */
export function createLLMProvider(config: LLMConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config as OpenAIConfig);
    case 'ollama':
      return new OllamaProvider(config as OllamaConfig);
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
  const provider = process.env.LLM_PROVIDER ?? 'openai';

  switch (provider) {
    case 'openai': {
      const config: OpenAIConfig = {
        provider: 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: process.env.OPENAI_DEFAULT_MODEL,
        fallbackModels: process.env.OPENAI_FALLBACK_MODELS?.split(','),
      };
      return new OpenAIProvider(config);
    }
    case 'ollama': {
      const config: OllamaConfig = {
        provider: 'ollama',
        baseUrl: process.env.OLLAMA_BASE_URL,
        defaultModel: process.env.OLLAMA_DEFAULT_MODEL,
      };
      return new OllamaProvider(config);
    }
    default:
      throw new LLMError(
        `Unknown provider from env: ${provider}`,
        'UNKNOWN_PROVIDER',
        false
      );
  }
}

/**
 * Get the default provider configuration
 */
export function getDefaultConfig(): LLMConfig {
  return {
    provider: 'openai',
    defaultModel: 'gpt-4o-mini',
    fallbackModels: ['gpt-4o', 'gpt-3.5-turbo'],
  };
}
