'use client';

import { Check, Copy, Eye, EyeOff, Key } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface ApiKeyQuickCopyProps {
  apiKey: string;
  masked?: boolean;
  showReveal?: boolean;
  className?: string;
  onCopy?: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function maskApiKey(key: string): string {
  if (!key || key.length < 12) return '••••••••••••';
  const prefix = key.slice(0, 12);
  return `${prefix}••••••••••••••••••••`;
}

// =============================================================================
// Components
// =============================================================================

export function ApiKeyQuickCopy({
  apiKey,
  masked = true,
  showReveal = true,
  className,
  onCopy,
}: ApiKeyQuickCopyProps): React.ReactElement {
  const [isCopied, setIsCopied] = React.useState(false);
  const [isRevealed, setIsRevealed] = React.useState(false);

  const displayValue = React.useMemo(() => {
    if (!masked || isRevealed) return apiKey;
    return maskApiKey(apiKey);
  }, [apiKey, masked, isRevealed]);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setIsCopied(true);
      onCopy?.();

      // Reset after 2 seconds
      setTimeout(() => setIsCopied(false), 2000);
    } catch (_error) {}
  }, [apiKey, onCopy]);

  return (
    <div
      className={cn('flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2', className)}
    >
      <Key className="h-4 w-4 shrink-0 text-muted-foreground" />
      <code
        className={cn('flex-1 truncate font-mono text-sm', !isRevealed && masked && 'select-none')}
      >
        {displayValue}
      </code>

      <div className="flex items-center gap-1">
        {showReveal && masked && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsRevealed(!isRevealed)}
                >
                  {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isRevealed ? 'Hide' : 'Reveal'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8 transition-colors', isCopied && 'text-green-600')}
                onClick={handleCopy}
              >
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isCopied ? 'Copied!' : 'Copy to clipboard'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

// =============================================================================
// Inline Version (smaller, for tables)
// =============================================================================

interface ApiKeyInlineCopyProps {
  apiKey: string;
  className?: string;
  onCopy?: () => void;
}

export function ApiKeyInlineCopy({
  apiKey,
  className,
  onCopy,
}: ApiKeyInlineCopyProps): React.ReactElement {
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setIsCopied(true);
      onCopy?.();

      setTimeout(() => setIsCopied(false), 2000);
    } catch (_error) {}
  }, [apiKey, onCopy]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 gap-1.5 px-2 font-mono text-xs transition-colors',
              isCopied && 'text-green-600',
              className
            )}
            onClick={handleCopy}
          >
            <Key className="h-3 w-3" />
            <span className="max-w-[120px] truncate">{maskApiKey(apiKey)}</span>
            {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3 opacity-50" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isCopied ? 'Copied!' : 'Click to copy full key'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// Secure Display (masked only, no copy)
// =============================================================================

interface ApiKeyMaskedProps {
  prefix: string;
  className?: string;
}

export function ApiKeyMasked({ prefix, className }: ApiKeyMaskedProps): React.ReactElement {
  return (
    <div className={cn('inline-flex items-center gap-1.5 font-mono text-sm', className)}>
      <Key className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-foreground">{prefix}</span>
      <span className="text-muted-foreground">••••••••••••</span>
    </div>
  );
}

export default ApiKeyQuickCopy;
