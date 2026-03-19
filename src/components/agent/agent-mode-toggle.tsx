"use client";

import React from "react";
import { Sparkles, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  size?: "sm" | "default";
}

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
  size = "default",
}: AgentModeToggleProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border bg-background p-2 transition-colors",
              enabled && "border-primary/50 bg-primary/5",
              disabled && "opacity-50 cursor-not-allowed",
              className
            )}
          >
            {/* Agent Icon with animation when enabled */}
            <div
              className={cn(
                "flex items-center justify-center rounded-full transition-all duration-300",
                size === "sm" ? "h-6 w-6" : "h-8 w-8",
                enabled
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {enabled ? (
                <div className="relative">
                  <Bot className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
                  {/* Animated sparkles */}
                  <Sparkles
                    className={cn(
                      "absolute -right-2 -top-2 text-yellow-400 animate-pulse",
                      size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"
                    )}
                  />
                </div>
              ) : (
                <Bot className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
              )}
            </div>

            {/* Label and description */}
            {showLabel && (
              <div className="flex flex-col">
                <Label
                  htmlFor="agent-mode"
                  className={cn(
                    "cursor-pointer font-medium",
                    size === "sm" && "text-xs",
                    enabled && "text-primary"
                  )}
                >
                  Agent Mode
                </Label>
                <span
                  className={cn(
                    "text-muted-foreground",
                    size === "sm" ? "text-[10px]" : "text-xs"
                  )}
                >
                  {enabled ? "AI will use tools" : "Enable for tool use"}
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
                "data-[state=checked]:bg-primary",
                size === "sm" && "scale-75 origin-right"
              )}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-xs">
            {enabled
              ? "Agent mode is active. The AI will use tools like search, calculator, and web search to answer your questions."
              : "Enable agent mode to allow the AI to use tools for more complex tasks."}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact version of the agent mode toggle for use in headers or toolbars
 */
export function AgentModeToggleCompact({
  enabled,
  onToggle,
  disabled = false,
  className,
}: Omit<AgentModeToggleProps, "showLabel" | "size">) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => !disabled && onToggle(!enabled)}
            disabled={disabled}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-all",
              enabled
                ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                : "border-muted bg-muted/50 text-muted-foreground hover:bg-muted",
              disabled && "opacity-50 cursor-not-allowed",
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
                "ml-0.5 h-1.5 w-1.5 rounded-full transition-colors",
                enabled ? "bg-green-500" : "bg-gray-300"
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">
            {enabled ? "Agent mode on" : "Agent mode off"} - Click to toggle
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
