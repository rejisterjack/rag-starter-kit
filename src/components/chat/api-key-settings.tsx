'use client';

import { Eye, EyeOff, Key, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { maskKey, PROVIDERS, useProviderKeys } from '@/hooks/use-provider-keys';

export function ApiKeySettings(): React.ReactElement {
  const { keys, save, remove, has } = useProviderKeys();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const toggleVisible = (id: string) => {
    setVisible((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSave = (providerId: string) => {
    const value = drafts[providerId]?.trim();
    if (value) {
      save(providerId as 'openrouter' | 'fireworks', value);
      setDrafts((prev) => ({ ...prev, [providerId]: '' }));
    }
  };

  const handleRemove = (providerId: string) => {
    remove(providerId as 'openrouter' | 'fireworks');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
        >
          <Key className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">API Keys</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-4 glass-panel border-border/30 shadow-2xl rounded-2xl"
      >
        <div className="space-y-1 mb-3">
          <h4 className="text-sm font-semibold">Provider API Keys</h4>
          <p className="text-xs text-muted-foreground">
            Enter your own keys. Stored locally, never sent to our server database.
          </p>
        </div>
        <Separator className="mb-3" />
        <div className="space-y-4">
          {PROVIDERS.map((provider) => (
            <div key={provider.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">{provider.name}</Label>
                {has(provider.id) && (
                  <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Key set
                  </span>
                )}
              </div>
              {has(provider.id) ? (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-8 px-2 flex items-center rounded-md border bg-muted/50 text-xs text-muted-foreground font-mono truncate">
                    {visible[provider.id] ? keys[provider.id] : maskKey(keys[provider.id]!)}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => toggleVisible(provider.id)}
                  >
                    {visible[provider.id] ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleRemove(provider.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="password"
                    placeholder={provider.placeholder}
                    value={drafts[provider.id] ?? ''}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [provider.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave(provider.id);
                    }}
                    className="h-8 text-xs font-mono"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    disabled={!drafts[provider.id]?.trim()}
                    onClick={() => handleSave(provider.id)}
                  >
                    Save
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
