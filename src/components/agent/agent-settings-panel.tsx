"use client";

import React from "react";
import { Settings, RotateCcw, Bot, Wrench, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

/** Configuration for available tools */
export interface ToolConfig {
  /** Tool identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** Whether the tool is enabled */
  enabled: boolean;
  /** Icon name (optional) */
  icon?: string;
}

/** Available AI models */
export interface ModelOption {
  /** Model identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of the model */
  description?: string;
  /** Whether the model supports tool use */
  supportsTools: boolean;
}

/** Agent settings configuration */
export interface AgentSettings {
  /** Maximum number of iterations/steps */
  maxIterations: number;
  /** Selected model ID */
  model: string;
  /** Temperature for generation (0-1) */
  temperature: number;
  /** Enabled tools */
  tools: ToolConfig[];
  /** Whether to enable streaming responses */
  streamingEnabled: boolean;
  /** Whether to show reasoning steps */
  showReasoning: boolean;
}

export interface AgentSettingsPanelProps {
  /** Current settings */
  settings: AgentSettings;
  /** Callback when settings change */
  onSettingsChange: (settings: AgentSettings) => void;
  /** Available models to choose from */
  availableModels?: ModelOption[];
  /** Available tools to configure */
  availableTools?: ToolConfig[];
  /** Whether to show the panel in a card */
  inCard?: boolean;
  /** Optional className for styling */
  className?: string;
  /** Callback to reset settings to defaults */
  onReset?: () => void;
}

const DEFAULT_MODELS: ModelOption[] = [
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    description: "Fast and cost-effective",
    supportsTools: true,
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Most capable",
    supportsTools: true,
  },
  {
    id: "claude-3-haiku",
    name: "Claude 3 Haiku",
    description: "Fast and efficient",
    supportsTools: true,
  },
  {
    id: "claude-3-sonnet",
    name: "Claude 3 Sonnet",
    description: "Balanced performance",
    supportsTools: true,
  },
];

const DEFAULT_TOOLS: ToolConfig[] = [
  {
    id: "document_search",
    name: "Document Search",
    description: "Search through uploaded documents",
    enabled: true,
  },
  {
    id: "calculator",
    name: "Calculator",
    description: "Perform mathematical calculations",
    enabled: true,
  },
  {
    id: "web_search",
    name: "Web Search",
    description: "Search the web for current information",
    enabled: false,
  },
  {
    id: "current_time",
    name: "Current Time",
    description: "Get the current date and time",
    enabled: true,
  },
];

/**
 * Panel to configure agent behavior
 * Includes max iterations slider, tool enablement toggles, and model selection
 */
export function AgentSettingsPanel({
  settings,
  onSettingsChange,
  availableModels = DEFAULT_MODELS,
  availableTools = DEFAULT_TOOLS,
  inCard = true,
  className,
  onReset,
}: AgentSettingsPanelProps) {
  // Initialize tools if not set
  const tools = settings.tools.length > 0 ? settings.tools : availableTools;

  const updateSetting = <K extends keyof AgentSettings>(
    key: K,
    value: AgentSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const toggleTool = (toolId: string) => {
    const updatedTools = tools.map((tool) =>
      tool.id === toolId ? { ...tool, enabled: !tool.enabled } : tool
    );
    updateSetting("tools", updatedTools);
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      onSettingsChange({
        maxIterations: 5,
        model: availableModels[0]?.id || "gpt-4o-mini",
        temperature: 0.1,
        tools: availableTools.map((t) => ({ ...t, enabled: true })),
        streamingEnabled: true,
        showReasoning: true,
      });
    }
  };

  const content = (
    <div className="space-y-6">
      {/* Model Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Model</Label>
        </div>
        <Select
          value={settings.model}
          onValueChange={(value) => updateSetting("model", value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {availableModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{model.name}</span>
                  {model.description && (
                    <span className="text-xs text-muted-foreground">
                      {model.description}
                      {!model.supportsTools && " (No tool support)"}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Max Iterations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium">Max Iterations</Label>
          </div>
          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
            {settings.maxIterations}
          </span>
        </div>
        <Slider
          value={[settings.maxIterations]}
          onValueChange={([value]: number[]) => updateSetting("maxIterations", value)}
          min={1}
          max={10}
          step={1}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Maximum number of reasoning steps the agent can take before providing
          an answer.
        </p>
      </div>

      <Separator />

      {/* Temperature */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Temperature</Label>
          <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
            {settings.temperature.toFixed(1)}
          </span>
        </div>
        <Slider
          value={[settings.temperature]}
          onValueChange={([value]: number[]) => updateSetting("temperature", value)}
          min={0}
          max={1}
          step={0.1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Precise</span>
          <span>Balanced</span>
          <span>Creative</span>
        </div>
      </div>

      <Separator />

      {/* Tool Enablement */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Enabled Tools</Label>
        </div>
        <div className="space-y-2">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className="flex items-start justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{tool.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tool.description}
                </p>
              </div>
              <Switch
                checked={tool.enabled}
                onCheckedChange={() => toggleTool(tool.id)}
                aria-label={`Enable ${tool.name}`}
              />
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Additional Options */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Additional Options</Label>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Streaming</Label>
              <p className="text-xs text-muted-foreground">
                Stream responses in real-time
              </p>
            </div>
            <Switch
              checked={settings.streamingEnabled}
              onCheckedChange={(checked: boolean) =>
                updateSetting("streamingEnabled", checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">Show Reasoning</Label>
              <p className="text-xs text-muted-foreground">
                Display agent thought process
              </p>
            </div>
            <Switch
              checked={settings.showReasoning}
              onCheckedChange={(checked: boolean) =>
                updateSetting("showReasoning", checked)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (inCard) {
    return (
      <Card className={cn("w-full max-w-md", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5" />
            Agent Settings
          </CardTitle>
          <CardDescription>
            Configure how the AI agent behaves and processes your queries
          </CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
        {onReset && (
          <CardFooter className="border-t bg-muted/50 px-6 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Defaults
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  }

  return content;
}

/**
 * Compact agent settings summary for display in headers
 */
export function AgentSettingsSummary({
  settings,
  className,
}: {
  settings: AgentSettings;
  className?: string;
}) {
  const enabledToolsCount = settings.tools.filter((t) => t.enabled).length;

  return (
    <div className={cn("flex items-center gap-3 text-xs text-muted-foreground", className)}>
      <span className="flex items-center gap-1">
        <Cpu className="h-3 w-3" />
        {settings.model}
      </span>
      <span>·</span>
      <span className="flex items-center gap-1">
        <Bot className="h-3 w-3" />
        {settings.maxIterations} max steps
      </span>
      <span>·</span>
      <span className="flex items-center gap-1">
        <Wrench className="h-3 w-3" />
        {enabledToolsCount} tools
      </span>
    </div>
  );
}
