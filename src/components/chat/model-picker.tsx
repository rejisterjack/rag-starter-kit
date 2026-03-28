'use client';

import { ChevronDown, Cpu, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// =============================================================================
// Model Definitions
// =============================================================================

export interface ModelOption {
  id: string;
  name: string;
  provider: 'openrouter' | 'ollama' | 'openai';
  description: string;
  contextWindow: number;
  isFree?: boolean;
  badge?: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  // OpenRouter Free Models
  {
    id: 'deepseek/deepseek-chat:free',
    name: 'DeepSeek Chat',
    provider: 'openrouter',
    description: 'Excellent reasoning, fast responses',
    contextWindow: 32768,
    isFree: true,
    badge: 'Best Overall',
  },
  {
    id: 'mistralai/mistral-7b-instruct:free',
    name: 'Mistral 7B',
    provider: 'openrouter',
    description: 'Fast, reliable, good for most tasks',
    contextWindow: 32768,
    isFree: true,
  },
  {
    id: 'meta-llama/llama-3.1-8b-instruct:free',
    name: 'Llama 3.1 8B',
    provider: 'openrouter',
    description: "Meta's latest open model",
    contextWindow: 128000,
    isFree: true,
  },
  {
    id: 'google/gemma-2-9b-it:free',
    name: 'Gemma 2 9B',
    provider: 'openrouter',
    description: "Google's open model",
    contextWindow: 8192,
    isFree: true,
  },
  {
    id: 'qwen/qwen-2.5-7b-instruct:free',
    name: 'Qwen 2.5 7B',
    provider: 'openrouter',
    description: "Alibaba's model, good multilingual support",
    contextWindow: 32768,
    isFree: true,
  },
  // Ollama Models (local)
  {
    id: 'llama3',
    name: 'Llama 3 (Local)',
    provider: 'ollama',
    description: 'Self-hosted Llama 3 via Ollama',
    contextWindow: 8192,
    badge: 'Local',
  },
  {
    id: 'mistral',
    name: 'Mistral (Local)',
    provider: 'ollama',
    description: 'Self-hosted Mistral via Ollama',
    contextWindow: 32768,
    badge: 'Local',
  },
  {
    id: 'phi3',
    name: 'Phi-3 (Local)',
    provider: 'ollama',
    description: 'Microsoft Phi-3, great for coding',
    contextWindow: 128000,
    badge: 'Local',
  },
];

// =============================================================================
// Component Props
// =============================================================================

interface ModelPickerProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatContextWindow(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(0)}k`;
  }
  return `${tokens}`;
}

function getProviderIcon(provider: ModelOption['provider']) {
  switch (provider) {
    case 'openrouter':
      return <Sparkles className="h-4 w-4 text-yellow-500" />;
    case 'ollama':
      return <Cpu className="h-4 w-4 text-blue-500" />;
    case 'openai':
      return <Sparkles className="h-4 w-4 text-green-500" />;
    default:
      return <Sparkles className="h-4 w-4" />;
  }
}

// =============================================================================
// Model Picker Component
// =============================================================================

export function ModelPicker({
  selectedModel,
  onModelChange,
  disabled = false,
  className,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);

  const currentModel = AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  // Group models by provider
  const openRouterModels = AVAILABLE_MODELS.filter((m) => m.provider === 'openrouter');
  const ollamaModels = AVAILABLE_MODELS.filter((m) => m.provider === 'ollama');

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn('h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground', className)}
        >
          {getProviderIcon(currentModel.provider)}
          <span className="max-w-[120px] truncate hidden sm:inline">{currentModel.name}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          {currentModel.isFree && (
            <span className="ml-1 text-[10px] bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full font-medium">
              Free
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Select Model
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* OpenRouter Free Models */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            OpenRouter (Free Tier)
          </DropdownMenuLabel>
          {openRouterModels.map((model) => (
            <DropdownMenuItem
              key={model.id}
              onClick={() => {
                onModelChange(model.id);
                setOpen(false);
              }}
              className={cn(
                'flex flex-col items-start gap-1 py-2 cursor-pointer',
                selectedModel === model.id && 'bg-accent'
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <span className="font-medium">{model.name}</span>
                {model.isFree && (
                  <span className="text-[10px] bg-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                    Free
                  </span>
                )}
                {model.badge && model.badge !== 'Best Overall' && (
                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                    {model.badge}
                  </span>
                )}
                {selectedModel === model.id && (
                  <Sparkles className="h-3 w-3 ml-auto text-primary" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{model.description}</span>
                <span>·</span>
                <span>{formatContextWindow(model.contextWindow)} context</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Ollama Local Models */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Ollama (Local)
          </DropdownMenuLabel>
          {ollamaModels.map((model) => (
            <DropdownMenuItem
              key={model.id}
              onClick={() => {
                onModelChange(model.id);
                setOpen(false);
              }}
              className={cn(
                'flex flex-col items-start gap-1 py-2 cursor-pointer',
                selectedModel === model.id && 'bg-accent'
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <span className="font-medium">{model.name}</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                  Local
                </span>
                {selectedModel === model.id && <Cpu className="h-3 w-3 ml-auto text-primary" />}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{model.description}</span>
                <span>·</span>
                <span>{formatContextWindow(model.contextWindow)} context</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// =============================================================================
// Compact Model Badge
// =============================================================================

interface ModelBadgeProps {
  modelId: string;
  className?: string;
}

export function ModelBadge({ modelId, className }: ModelBadgeProps) {
  const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (!model) return null;

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-muted-foreground', className)}>
      {getProviderIcon(model.provider)}
      <span className="truncate max-w-[100px]">{model.name}</span>
      {model.isFree && (
        <span className="text-[10px] bg-green-500/20 text-green-600 dark:text-green-400 px-1 rounded">
          Free
        </span>
      )}
    </span>
  );
}

export default ModelPicker;
