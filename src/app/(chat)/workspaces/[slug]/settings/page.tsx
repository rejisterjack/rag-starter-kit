'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Loader2, Save, Trash2, Users } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const settingsSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().max(200).optional(),
  chunkingStrategy: z.enum(['fixed', 'semantic', 'hierarchical', 'late']),
  chunkSize: z.number().min(100).max(4000),
  chunkOverlap: z.number().min(0).max(1000),
  topK: z.number().min(1).max(20),
  similarityThreshold: z.number().min(0).max(1),
  rerankingEnabled: z.boolean(),
  hybridSearchEnabled: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  settings: {
    rag?: {
      chunkingStrategy?: 'fixed' | 'semantic' | 'hierarchical' | 'late';
      chunkSize?: number;
      chunkOverlap?: number;
      topK?: number;
      similarityThreshold?: number;
      rerankingEnabled?: boolean;
      hybridSearchEnabled?: boolean;
    };
  };
}

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: '',
      description: '',
      chunkingStrategy: 'fixed',
      chunkSize: 1000,
      chunkOverlap: 200,
      topK: 5,
      similarityThreshold: 0.7,
      rerankingEnabled: false,
      hybridSearchEnabled: true,
    },
  });

  const fetchWorkspace = useCallback(async () => {
    try {
      const response = await fetch('/api/workspaces');
      if (!response.ok) throw new Error('Failed to fetch workspaces');

      const data = await response.json();
      const found = data.data.workspaces.find((w: Workspace) => w.slug === slug);

      if (found) {
        setWorkspace(found);
        const ragSettings = found.settings?.rag || {};
        reset({
          name: found.name,
          description: found.description || '',
          chunkingStrategy: ragSettings.chunkingStrategy || 'fixed',
          chunkSize: ragSettings.chunkSize || 1000,
          chunkOverlap: ragSettings.chunkOverlap || 200,
          topK: ragSettings.topK || 5,
          similarityThreshold: ragSettings.similarityThreshold || 0.7,
          rerankingEnabled: ragSettings.rerankingEnabled || false,
          hybridSearchEnabled: ragSettings.hybridSearchEnabled !== false,
        });
      } else {
        toast.error('Workspace not found');
        router.push('/chat');
      }
    } catch (_error: unknown) {
      toast.error('Failed to load workspace settings');
    } finally {
      setIsLoading(false);
    }
  }, [slug, reset, router]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const onSubmit = async (data: SettingsFormData) => {
    if (!workspace) return;

    setIsSaving(true);
    try {
      // Update workspace details
      const workspaceResponse = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
        }),
      });

      if (!workspaceResponse.ok) throw new Error('Failed to update workspace');

      // Update RAG settings
      const ragResponse = await fetch(`/api/workspaces/${workspace.id}/rag-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkingStrategy: data.chunkingStrategy,
          chunkSize: data.chunkSize,
          chunkOverlap: data.chunkOverlap,
          topK: data.topK,
          similarityThreshold: data.similarityThreshold,
          rerankingEnabled: data.rerankingEnabled,
          hybridSearchEnabled: data.hybridSearchEnabled,
        }),
      });

      if (!ragResponse.ok) throw new Error('Failed to update RAG settings');

      toast.success('Settings saved successfully');
    } catch (_error: unknown) {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspace) return;
    if (!confirm('Are you sure you want to delete this workspace? This action cannot be undone.'))
      return;

    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete workspace');

      toast.success('Workspace deleted');
      router.push('/chat');
    } catch (_error: unknown) {
      toast.error('Failed to delete workspace');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Workspace Settings</h1>
          <p className="text-muted-foreground">Manage your workspace configuration</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="general">
              <Building2 className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="rag">
              <Save className="h-4 w-4 mr-2" />
              RAG Settings
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="h-4 w-4 mr-2" />
              Members
            </TabsTrigger>
            <TabsTrigger value="danger" className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Danger
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit(onSubmit)}>
            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>Basic workspace information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Workspace Name</Label>
                    <Input id="name" {...register('name')} />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" {...register('description')} rows={3} />
                  </div>

                  <div className="space-y-2">
                    <Label>Slug</Label>
                    <Input value={workspace.slug} disabled />
                    <p className="text-xs text-muted-foreground">Slug cannot be changed</p>
                  </div>

                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rag">
              <Card>
                <CardHeader>
                  <CardTitle>RAG Settings</CardTitle>
                  <CardDescription>Configure document processing and retrieval</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <Label>Chunking Strategy</Label>
                    <div className="grid grid-cols-2 gap-4">
                      {(['fixed', 'semantic', 'hierarchical', 'late'] as const).map((strategy) => (
                        <button
                          key={strategy}
                          type="button"
                          onClick={() => setValue('chunkingStrategy', strategy)}
                          className={`p-4 rounded-lg border text-left transition-all ${
                            watch('chunkingStrategy') === strategy
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="font-medium capitalize">{strategy}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {strategy === 'fixed' && 'Standard character-based splitting'}
                            {strategy === 'semantic' && 'Embedding-based boundaries'}
                            {strategy === 'hierarchical' && 'Parent-child relationships'}
                            {strategy === 'late' && 'Context-aware for long docs'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="chunkSize">Chunk Size</Label>
                      <Input
                        id="chunkSize"
                        type="number"
                        {...register('chunkSize', { valueAsNumber: true })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Characters per chunk (100-4000)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="chunkOverlap">Chunk Overlap</Label>
                      <Input
                        id="chunkOverlap"
                        type="number"
                        {...register('chunkOverlap', { valueAsNumber: true })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Overlap between chunks (0-1000)
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="topK">Top K Results</Label>
                      <Input
                        id="topK"
                        type="number"
                        {...register('topK', { valueAsNumber: true })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Number of chunks to retrieve (1-20)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="similarityThreshold">Similarity Threshold</Label>
                      <Input
                        id="similarityThreshold"
                        type="number"
                        step="0.1"
                        {...register('similarityThreshold', { valueAsNumber: true })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Minimum similarity score (0-1)
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="reranking">Re-ranking</Label>
                        <p className="text-sm text-muted-foreground">
                          Use cross-encoder re-ranking for better results
                        </p>
                      </div>
                      <Switch
                        id="reranking"
                        checked={watch('rerankingEnabled')}
                        onCheckedChange={(checked) => setValue('rerankingEnabled', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="hybrid">Hybrid Search</Label>
                        <p className="text-sm text-muted-foreground">
                          Combine vector and keyword search
                        </p>
                      </div>
                      <Switch
                        id="hybrid"
                        checked={watch('hybridSearchEnabled')}
                        onCheckedChange={(checked) => setValue('hybridSearchEnabled', checked)}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save RAG Settings
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="members">
              <Card>
                <CardHeader>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>Manage workspace members and permissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Member management coming soon. Use the API to manage members for now.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="danger">
              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                  <CardDescription>Destructive actions for this workspace</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="border border-destructive/20 rounded-lg p-4">
                    <h4 className="font-medium text-destructive">Delete Workspace</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      This will permanently delete the workspace and all associated data. This
                      action cannot be undone.
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      className="mt-4"
                      onClick={handleDeleteWorkspace}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Workspace
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </form>
        </Tabs>
      </div>
    </div>
  );
}
