'use client';

import { useState } from 'react';
import { Copy, Edit, Trash2, Plus, Star, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Prompt {
  id: string;
  name: string;
  description?: string;
  template: string;
  variables: string[];
  tags: string[];
  isFavorite: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface PromptLibraryProps {
  prompts: Prompt[];
  onCreate: (prompt: Omit<Prompt, 'id' | 'version' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<Prompt>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUse: (prompt: Prompt, variables: Record<string, string>) => void;
  className?: string;
}

export function PromptLibrary({
  prompts,
  onCreate,
  onUpdate,
  onDelete,
  onUse,
  className,
}: PromptLibraryProps) {
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [newPrompt, setNewPrompt] = useState({
    name: '',
    description: '',
    template: '',
    tags: [] as string[],
  });

  const filteredPrompts = prompts.filter((prompt) => {
    const matchesSearch =
      !search ||
      prompt.name.toLowerCase().includes(search.toLowerCase()) ||
      prompt.description?.toLowerCase().includes(search.toLowerCase()) ||
      prompt.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));

    const matchesTag = !selectedTag || prompt.tags.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  const allTags = Array.from(new Set(prompts.flatMap((p) => p.tags)));

  const extractVariables = (template: string): string[] => {
    const matches = template.match(/\{\{(\w+)\}\}/g);
    return matches ? matches.map((m) => m.slice(2, -2)) : [];
  };

  const handleCreate = async () => {
    if (!newPrompt.name || !newPrompt.template) {
      toast.error('Name and template are required');
      return;
    }

    const variables = extractVariables(newPrompt.template);

    await onCreate({
      ...newPrompt,
      variables,
      isFavorite: false,
    });

    setNewPrompt({ name: '', description: '', template: '', tags: [] });
    setIsCreating(false);
    toast.success('Prompt created');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search prompts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px]"
        />
        
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Prompt
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create Prompt</DialogTitle>
              <DialogDescription>
                Create a reusable prompt template. Use {'{{variable}}'} for dynamic content.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={newPrompt.name}
                  onChange={(e) => setNewPrompt((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Code Review"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={newPrompt.description}
                  onChange={(e) => setNewPrompt((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of this prompt"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Template</label>
                <Textarea
                  value={newPrompt.template}
                  onChange={(e) => setNewPrompt((p) => ({ ...p, template: e.target.value }))}
                  placeholder="Enter your prompt template. Use {{variable}} for dynamic values."
                  rows={6}
                />
                {extractVariables(newPrompt.template).length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Variables: {extractVariables(newPrompt.template).join(', ')}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tags (comma separated)</label>
                <Input
                  value={newPrompt.tags.join(', ')}
                  onChange={(e) =>
                    setNewPrompt((p) => ({
                      ...p,
                      tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                    }))
                  }
                  placeholder="coding, review, technical"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Prompt</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={selectedTag === null ? 'default' : 'secondary'}
            className="cursor-pointer"
            onClick={() => setSelectedTag(null)}
          >
            All
          </Badge>
          {allTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTag === tag ? 'default' : 'secondary'}
              className="cursor-pointer"
              onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Prompts Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPrompts.map((prompt) => (
          <Card key={prompt.id} className="group">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{prompt.name}</CardTitle>
                  {prompt.description && (
                    <CardDescription>{prompt.description}</CardDescription>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onUpdate(prompt.id, { isFavorite: !prompt.isFavorite })}
                  >
                    <Star
                      className={cn(
                        'h-4 w-4',
                        prompt.isFavorite && 'fill-yellow-400 text-yellow-400'
                      )}
                    />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {prompt.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              
              <p className="text-sm text-muted-foreground line-clamp-3">
                {prompt.template.slice(0, 150)}
                {prompt.template.length > 150 && '...'}
              </p>

              {prompt.variables.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {prompt.variables.map((v) => (
                    <code key={v} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {'{{'}{v}{'}}'}
                    </code>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => onUse(prompt, {})}
                >
                  Use
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => copyToClipboard(prompt.template)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditingPrompt(prompt)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => onDelete(prompt.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default PromptLibrary;
