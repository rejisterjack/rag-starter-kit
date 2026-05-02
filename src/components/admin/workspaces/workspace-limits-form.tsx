'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface WorkspaceData {
  maxDocuments: number;
  maxStorageMb: number;
  maxChats: number;
  maxChatPerDay: number;
  llmProvider: string | null;
  llmModel: string | null;
}

interface WorkspaceLimitsFormProps {
  workspaceId: string;
  workspace: WorkspaceData;
}

export function WorkspaceLimitsForm({ workspaceId, workspace }: WorkspaceLimitsFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    maxDocuments: workspace.maxDocuments.toString(),
    maxStorageMb: workspace.maxStorageMb.toString(),
    maxChats: workspace.maxChats.toString(),
    maxChatPerDay: workspace.maxChatPerDay.toString(),
    llmProvider: workspace.llmProvider || '',
    llmModel: workspace.llmModel || '',
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/workspaces/${workspaceId}/limits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxDocuments: parseInt(form.maxDocuments, 10),
          maxStorageMb: parseInt(form.maxStorageMb, 10),
          maxChats: parseInt(form.maxChats, 10),
          maxChatPerDay: parseInt(form.maxChatPerDay, 10),
          llmProvider: form.llmProvider || null,
          llmModel: form.llmModel || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update limits');
      }

      setMessage({ type: 'success', text: 'Limits updated successfully' });
      setTimeout(() => setMessage(null), 3000);
      setIsOpen(false);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update limits',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="rounded-full border-white/10 hover:bg-white/10"
        >
          Edit Limits
        </Button>
        {message && (
          <span
            className={`text-xs ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {message.text}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-foreground/80">Resource Limits</h4>
      {message && (
        <div
          className={`text-xs px-3 py-2 rounded-lg ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}
        >
          {message.text}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`maxDocs-${workspaceId}`} className="text-xs text-muted-foreground">
            Max Documents
          </Label>
          <Input
            id={`maxDocs-${workspaceId}`}
            type="number"
            min={1}
            value={form.maxDocuments}
            onChange={(e) => handleChange('maxDocuments', e.target.value)}
            className="bg-white/5 border-white/10 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`maxStorage-${workspaceId}`} className="text-xs text-muted-foreground">
            Max Storage (MB)
          </Label>
          <Input
            id={`maxStorage-${workspaceId}`}
            type="number"
            min={1}
            value={form.maxStorageMb}
            onChange={(e) => handleChange('maxStorageMb', e.target.value)}
            className="bg-white/5 border-white/10 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`maxChats-${workspaceId}`} className="text-xs text-muted-foreground">
            Max Total Chats
          </Label>
          <Input
            id={`maxChats-${workspaceId}`}
            type="number"
            min={1}
            value={form.maxChats}
            onChange={(e) => handleChange('maxChats', e.target.value)}
            className="bg-white/5 border-white/10 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`maxChatDay-${workspaceId}`} className="text-xs text-muted-foreground">
            Max Chats / Day
          </Label>
          <Input
            id={`maxChatDay-${workspaceId}`}
            type="number"
            min={1}
            value={form.maxChatPerDay}
            onChange={(e) => handleChange('maxChatPerDay', e.target.value)}
            className="bg-white/5 border-white/10 text-sm"
          />
        </div>
      </div>

      <h4 className="text-sm font-semibold text-foreground/80 pt-2">LLM Configuration</h4>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">LLM Provider</Label>
          <Select
            value={form.llmProvider || 'default'}
            onValueChange={(val) => handleChange('llmProvider', val === 'default' ? '' : val)}
          >
            <SelectTrigger className="bg-white/5 border-white/10 text-sm">
              <SelectValue placeholder="Use default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Use default</SelectItem>
              <SelectItem value="openrouter">OpenRouter</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="ollama">Ollama</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`llmModel-${workspaceId}`} className="text-xs text-muted-foreground">
            LLM Model Override
          </Label>
          <Input
            id={`llmModel-${workspaceId}`}
            type="text"
            placeholder="e.g., gpt-4o-mini"
            value={form.llmModel}
            onChange={(e) => handleChange('llmModel', e.target.value)}
            className="bg-white/5 border-white/10 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-full bg-primary/90 hover:bg-primary"
        >
          {isSaving ? 'Saving...' : 'Save Limits'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsOpen(false);
            setMessage(null);
          }}
          className="rounded-full text-muted-foreground"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
