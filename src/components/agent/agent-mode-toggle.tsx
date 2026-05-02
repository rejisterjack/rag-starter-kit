'use client';

import { Bot, Settings, Sparkles, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface AgentModeToggleProps {
  /** Whether agent mode is enabled */
  enabled: boolean;
  /** Callback when toggle changes */
  onToggle: (enabled: boolean) => void;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Optional className for styling */
  className?: string;
  /** Show label text next to toggle */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'default';
}

export interface AgentSettings {
  enabledTools: string[];
  maxIterations: number;
  agentMode: 'reactive' | 'planning';
}

const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  enabledTools: ['calculator', 'document_search', 'current_time', 'web_search'],
  maxIterations: 5,
  agentMode: 'reactive',
};

const ALL_TOOLS = [
  { id: 'calculator', label: 'Calculator', description: 'Math operations and conversions' },
  { id: 'document_search', label: 'Document Search', description: 'Search uploaded documents' },
  { id: 'document_summary', label: 'Document Summary', description: 'Summarize documents' },
  { id: 'web_search', label: 'Web Search', description: 'Search the internet' },
  { id: 'code_executor', label: 'Code Execution', description: 'Run code snippets' },
  { id: 'current_time', label: 'Current Time', description: 'Get date and time' },
];

// ============================================================================
// Settings Panel
// ============================================================================

function AgentSettingsPanel({
  settings,
  onSettingsChange,
  onClose,
}: {
  settings: AgentSettings;
  onSettingsChange: (settings: AgentSettings) => void;
  onClose: () => void;
}) {
  const toggleTool = useCallback(
    (toolId: string) => {
      const enabled = settings.enabledTools.includes(toolId);
      onSettingsChange({
        ...settings,
        enabledTools: enabled
          ? settings.enabledTools.filter((t) => t !== toolId)
          : [...settings.enabledTools, toolId],
      });
    },
    [settings, onSettingsChange]
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Agent Settings</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 hover:bg-white/10 transition-colors"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Agent mode */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Agent Mode
        </Label>
        <div className="flex gap-2">
          {(['reactive', 'planning'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onSettingsChange({ ...settings, agentMode: mode })}
              className={cn(
                'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                settings.agentMode === mode
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
              )}
            >
              {mode === 'reactive' ? 'Reactive' : 'Planning'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/60">
          {settings.agentMode === 'reactive'
            ? 'Agent reacts to each step and decides next action'
            : 'Agent creates a plan before executing steps'}
        </p>
      </div>

      {/* Max iterations */}
      <div className="space-y-2">
        <Label
          htmlFor="max-iterations"
          className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
        >
          Max Iterations
        </Label>
        <Input
          id="max-iterations"
          type="number"
          min={1}
          max={10}
          value={settings.maxIterations}
          onChange={(e) => {
            const val = Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 5));
            onSettingsChange({ ...settings, maxIterations: val });
          }}
          className="h-8 text-sm bg-white/5 border-white/10"
        />
        <p className="text-[10px] text-muted-foreground/60">
          Maximum number of reasoning steps (1-10)
        </p>
      </div>

      {/* Enabled tools */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Enabled Tools
        </Label>
        <div className="space-y-1.5">
          {ALL_TOOLS.map((tool) => (
            <div
              key={tool.id}
              className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Checkbox
                id={`tool-${tool.id}`}
                checked={settings.enabledTools.includes(tool.id)}
                onCheckedChange={() => toggleTool(tool.id)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground/90">{tool.label}</p>
                <p className="text-[10px] text-muted-foreground/60">{tool.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Toggle Component
// ============================================================================

/**
 * Toggle switch component to enable/disable Agent Mode
 * Shows an indicator when agent mode is active with sparkles animation
 */
export function AgentModeToggle({
  enabled,
  onToggle,
  disabled = false,
  className,
  showLabel = true,
  size = 'default',
}: AgentModeToggleProps) {
  const { state: settings, setState: setSettings } = usePersistentState<AgentSettings>({
    key: 'agent-settings',
    defaultValue: DEFAULT_AGENT_SETTINGS,
  });

  const handleSettingsChange = useCallback(
    (newSettings: AgentSettings) => {
      setSettings(newSettings);
    },
    [setSettings]
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border bg-background p-2 transition-colors',
              enabled && 'border-primary/50 bg-primary/5',
              disabled && 'opacity-50 cursor-not-allowed',
              className
            )}
          >
            {/* Agent Icon with animation when enabled */}
            <div
              className={cn(
                'flex items-center justify-center rounded-full transition-all duration-300',
                size === 'sm' ? 'h-6 w-6' : 'h-8 w-8',
                enabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}
            >
              {enabled ? (
                <div className="relative">
                  <Bot className={cn(size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                  {/* Animated sparkles */}
                  <Sparkles
                    className={cn(
                      'absolute -right-2 -top-2 text-yellow-400 animate-pulse',
                      size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'
                    )}
                  />
                </div>
              ) : (
                <Bot className={cn(size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
              )}
            </div>

            {/* Label and description */}
            {showLabel && (
              <div className="flex flex-col">
                <Label
                  htmlFor="agent-mode"
                  className={cn(
                    'cursor-pointer font-medium',
                    size === 'sm' && 'text-xs',
                    enabled && 'text-primary'
                  )}
                >
                  Agent Mode
                </Label>
                <span
                  className={cn('text-muted-foreground', size === 'sm' ? 'text-[10px]' : 'text-xs')}
                >
                  {enabled ? 'AI will use tools' : 'Enable for tool use'}
                </span>
              </div>
            )}

            {/* Toggle Switch */}
            <Switch
              id="agent-mode"
              checked={enabled}
              onCheckedChange={onToggle}
              disabled={disabled}
              className={cn(
                'data-[state=checked]:bg-primary',
                size === 'sm' && 'scale-75 origin-right'
              )}
            />

            {/* Settings gear */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'rounded-full p-1 transition-colors',
                    'hover:bg-white/10 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="end"
                className="w-72 rounded-2xl glass-panel border-white/10 shadow-2xl p-4 mr-2"
              >
                <AgentSettingsPanel
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                  onClose={() => {}}
                />
              </PopoverContent>
            </Popover>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">
            {enabled
              ? 'Agent mode is active. The AI will use tools like search, calculator, and web search to answer your questions.'
              : 'Enable agent mode to allow the AI to use tools for more complex tasks.'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Compact Toggle with Settings
// ============================================================================

/**
 * Compact version of the agent mode toggle for use in headers or toolbars.
 * Includes a gear icon popover for agent settings persisted via localStorage.
 */
export function AgentModeToggleCompact({
  enabled,
  onToggle,
  disabled = false,
  className,
}: Omit<AgentModeToggleProps, 'showLabel' | 'size'>) {
  const [showSettings, setShowSettings] = useState(false);

  const { state: settings, setState: setSettings } = usePersistentState<AgentSettings>({
    key: 'agent-settings',
    defaultValue: DEFAULT_AGENT_SETTINGS,
  });

  const handleSettingsChange = useCallback(
    (newSettings: AgentSettings) => {
      setSettings(newSettings);
    },
    [setSettings]
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => !disabled && onToggle(!enabled)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all',
                enabled
                  ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
                  : 'border-muted bg-muted/50 text-muted-foreground hover:bg-muted',
                disabled && 'opacity-50 cursor-not-allowed',
                className
              )}
            >
              <div className="relative">
                <Bot className="h-3.5 w-3.5" />
                {enabled && (
                  <Sparkles className="absolute -right-1.5 -top-1 h-2 w-2 text-yellow-400 animate-pulse" />
                )}
              </div>
              <span className="text-xs font-medium">Agent</span>
              <div
                className={cn(
                  'ml-0.5 h-1.5 w-1.5 rounded-full transition-colors',
                  enabled ? 'bg-green-500' : 'bg-gray-300'
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">
              {enabled ? 'Agent mode on' : 'Agent mode off'} - Click to toggle
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Settings gear */}
        <Popover open={showSettings} onOpenChange={setShowSettings}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'rounded-full p-1 transition-colors',
                showSettings
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/10',
                disabled && 'opacity-50'
              )}
            >
              <Settings className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="bottom"
            align="end"
            className="w-72 rounded-2xl glass-panel border-white/10 shadow-2xl p-4"
          >
            <AgentSettingsPanel
              settings={settings}
              onSettingsChange={handleSettingsChange}
              onClose={() => setShowSettings(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  );
}
