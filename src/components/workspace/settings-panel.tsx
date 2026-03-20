'use client';

import { Building2, Palette, Save, Shield } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface WorkspaceSettings {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar: string | null;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  settings?: {
    defaultModel?: string;
    defaultTemperature?: number;
    maxTokens?: number;
    chunkSize?: number;
    chunkOverlap?: number;
    topK?: number;
    similarityThreshold?: number;
  };
}

interface SettingsPanelProps {
  workspace: WorkspaceSettings;
  canManageSettings: boolean;
}

export function SettingsPanel({
  workspace,
  canManageSettings,
}: SettingsPanelProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // General settings state
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || '');
  const [slug, setSlug] = useState(workspace.slug);

  // RAG settings state
  const [ragSettings, setRagSettings] = useState({
    defaultModel: workspace.settings?.defaultModel || 'gpt-4o-mini',
    defaultTemperature: workspace.settings?.defaultTemperature || 0.7,
    maxTokens: workspace.settings?.maxTokens || 2000,
    chunkSize: workspace.settings?.chunkSize || 1000,
    chunkOverlap: workspace.settings?.chunkOverlap || 200,
    topK: workspace.settings?.topK || 5,
    similarityThreshold: workspace.settings?.similarityThreshold || 0.7,
  });

  const handleSaveGeneral = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          slug,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update workspace');
      }
    } catch (_error) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRAG = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/workspaces/${workspace.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: ragSettings,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update RAG settings');
      }
    } catch (_error) {
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
        <TabsTrigger value="general" className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span className="hidden sm:inline">General</span>
        </TabsTrigger>
        <TabsTrigger value="rag" className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          <span className="hidden sm:inline">RAG Settings</span>
        </TabsTrigger>
        <TabsTrigger value="security" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span className="hidden sm:inline">Security</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canManageSettings || isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Workspace URL</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {typeof window !== 'undefined' ? window.location.origin : ''}/
              </span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={!canManageSettings || isLoading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Only lowercase letters, numbers, and hyphens allowed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your workspace..."
              disabled={!canManageSettings || isLoading}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Plan</Label>
            <div className="flex items-center gap-4">
              <div className="rounded-lg border px-4 py-2">
                <span className="font-medium">{workspace.plan}</span>
              </div>
              {workspace.plan === 'FREE' && (
                <Button variant="outline" size="sm">
                  Upgrade
                </Button>
              )}
            </div>
          </div>
        </div>

        {canManageSettings && (
          <>
            <Separator />
            <div className="flex justify-end">
              <Button onClick={handleSaveGeneral} disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                Save changes
              </Button>
            </div>
          </>
        )}
      </TabsContent>

      <TabsContent value="rag" className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultModel">Default Model</Label>
            <select
              id="defaultModel"
              value={ragSettings.defaultModel}
              onChange={(e) => setRagSettings({ ...ragSettings, defaultModel: e.target.value })}
              disabled={!canManageSettings}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultTemperature">
              Temperature ({ragSettings.defaultTemperature})
            </Label>
            <input
              id="defaultTemperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={ragSettings.defaultTemperature}
              onChange={(e) =>
                setRagSettings({
                  ...ragSettings,
                  defaultTemperature: parseFloat(e.target.value),
                })
              }
              disabled={!canManageSettings}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Lower values make responses more focused and deterministic.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chunkSize">Chunk Size</Label>
            <Input
              id="chunkSize"
              type="number"
              value={ragSettings.chunkSize}
              onChange={(e) =>
                setRagSettings({
                  ...ragSettings,
                  chunkSize: parseInt(e.target.value, 10),
                })
              }
              disabled={!canManageSettings}
            />
            <p className="text-xs text-muted-foreground">
              Number of characters per document chunk.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chunkOverlap">Chunk Overlap</Label>
            <Input
              id="chunkOverlap"
              type="number"
              value={ragSettings.chunkOverlap}
              onChange={(e) =>
                setRagSettings({
                  ...ragSettings,
                  chunkOverlap: parseInt(e.target.value, 10),
                })
              }
              disabled={!canManageSettings}
            />
            <p className="text-xs text-muted-foreground">
              Number of overlapping characters between chunks.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topK">Top K Results</Label>
            <Input
              id="topK"
              type="number"
              min="1"
              max="20"
              value={ragSettings.topK}
              onChange={(e) =>
                setRagSettings({
                  ...ragSettings,
                  topK: parseInt(e.target.value, 10),
                })
              }
              disabled={!canManageSettings}
            />
            <p className="text-xs text-muted-foreground">
              Number of document chunks to retrieve for context.
            </p>
          </div>
        </div>

        {canManageSettings && (
          <>
            <Separator />
            <div className="flex justify-end">
              <Button onClick={handleSaveRAG} disabled={isLoading}>
                <Save className="mr-2 h-4 w-4" />
                Save RAG settings
              </Button>
            </div>
          </>
        )}
      </TabsContent>

      <TabsContent value="security" className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Require approval for uploads</Label>
              <p className="text-sm text-muted-foreground">
                Admin approval required for new document uploads
              </p>
            </div>
            <SwitchComponent disabled={!canManageSettings} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Restrict email domains</Label>
              <p className="text-sm text-muted-foreground">
                Only allow members from specific email domains
              </p>
            </div>
            <SwitchComponent disabled={!canManageSettings} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Enable audit logging</Label>
              <p className="text-sm text-muted-foreground">Track all actions in the workspace</p>
            </div>
            <Switch defaultChecked disabled />
          </div>
        </div>

        {canManageSettings && workspace.plan !== 'FREE' && (
          <>
            <Separator />
            <div className="rounded-lg border border-destructive/50 p-4">
              <h4 className="font-medium text-destructive">Danger Zone</h4>
              <p className="text-sm text-muted-foreground">
                Irreversible actions for your workspace.
              </p>
              <div className="mt-4 flex gap-4">
                <Button variant="outline" className="text-destructive">
                  Delete workspace
                </Button>
              </div>
            </div>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}

// Switch wrapper for consistent usage
function SwitchComponent({ disabled }: { disabled?: boolean }) {
  return <Switch disabled={disabled} />;
}
