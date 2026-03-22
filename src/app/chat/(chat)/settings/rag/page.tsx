'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, RotateCcw, Brain, FileText, Thermometer, Database, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface RAGSettings {
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  temperature: number;
  maxTokens: number;
  embeddingModel: string;
  rerankingEnabled: boolean;
  hybridSearchEnabled: boolean;
}

const defaultSettings: RAGSettings = {
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 5,
  similarityThreshold: 0.7,
  temperature: 0.7,
  maxTokens: 2000,
  embeddingModel: 'text-embedding-004',
  rerankingEnabled: false,
  hybridSearchEnabled: true,
};

const embeddingModels = [
  { value: 'text-embedding-004', label: 'Google Gemini (text-embedding-004)', free: true },
  { value: 'text-embedding-3-small', label: 'OpenAI (text-embedding-3-small)', free: false },
  { value: 'text-embedding-3-large', label: 'OpenAI (text-embedding-3-large)', free: false },
];

export default function RAGSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<RAGSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/workspaces/current/rag-settings');
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings({ ...defaultSettings, ...data.settings });
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch('/api/workspaces/current/rag-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
  };

  const updateSetting = <K extends keyof RAGSettings>(
    key: K,
    value: RAGSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">RAG Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure retrieval and generation parameters for your workspace
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saved && (
        <Alert className="bg-green-500/10 border-green-500/20 text-green-500">
          <AlertDescription>Settings saved successfully!</AlertDescription>
        </Alert>
      )}

      {/* Chunking Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Chunking
          </CardTitle>
          <CardDescription>
            Control how documents are split into searchable chunks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Chunk Size</Label>
                <span className="text-sm text-muted-foreground">{settings.chunkSize} chars</span>
              </div>
              <Slider
                value={[settings.chunkSize]}
                onValueChange={([v]) => updateSetting('chunkSize', v)}
                min={100}
                max={4000}
                step={100}
              />
              <p className="text-xs text-muted-foreground">
                Size of each text chunk. Larger chunks capture more context but reduce precision.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Chunk Overlap</Label>
                <span className="text-sm text-muted-foreground">{settings.chunkOverlap} chars</span>
              </div>
              <Slider
                value={[settings.chunkOverlap]}
                onValueChange={([v]) => updateSetting('chunkOverlap', v)}
                min={0}
                max={1000}
                step={50}
              />
              <p className="text-xs text-muted-foreground">
                Overlap between consecutive chunks to maintain context continuity.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retrieval Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Retrieval
          </CardTitle>
          <CardDescription>
            Configure how relevant documents are retrieved
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Top-K Results</Label>
                <span className="text-sm text-muted-foreground">{settings.topK} chunks</span>
              </div>
              <Slider
                value={[settings.topK]}
                onValueChange={([v]) => updateSetting('topK', v)}
                min={1}
                max={20}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Number of most relevant chunks to retrieve per query.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Similarity Threshold</Label>
                <span className="text-sm text-muted-foreground">
                  {settings.similarityThreshold.toFixed(2)}
                </span>
              </div>
              <Slider
                value={[settings.similarityThreshold * 100]}
                onValueChange={([v]) => updateSetting('similarityThreshold', v / 100)}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Minimum similarity score (0-1) for a chunk to be considered relevant.
              </p>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label>Hybrid Search</Label>
                <p className="text-xs text-muted-foreground">
                  Combine vector similarity with keyword matching
                </p>
              </div>
              <Switch
                checked={settings.hybridSearchEnabled}
                onCheckedChange={(v) => updateSetting('hybridSearchEnabled', v)}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label>Reranking</Label>
                <p className="text-xs text-muted-foreground">
                  Use cross-encoder reranking for better relevance (slower)
                </p>
              </div>
              <Switch
                checked={settings.rerankingEnabled}
                onCheckedChange={(v) => updateSetting('rerankingEnabled', v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Generation
          </CardTitle>
          <CardDescription>
            Control LLM response generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Temperature</Label>
                <span className="text-sm text-muted-foreground">{settings.temperature.toFixed(1)}</span>
              </div>
              <Slider
                value={[settings.temperature * 10]}
                onValueChange={([v]) => updateSetting('temperature', v / 10)}
                min={0}
                max={20}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Deterministic (0.0)</span>
                <span>Balanced (1.0)</span>
                <span>Creative (2.0)</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Max Tokens</Label>
                <span className="text-sm text-muted-foreground">{settings.maxTokens}</span>
              </div>
              <Slider
                value={[settings.maxTokens]}
                onValueChange={([v]) => updateSetting('maxTokens', v)}
                min={256}
                max={8192}
                step={256}
              />
              <p className="text-xs text-muted-foreground">
                Maximum response length. Higher values allow longer answers.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="embedding-model">Embedding Model</Label>
              <select
                id="embedding-model"
                value={settings.embeddingModel}
                onChange={(e) => updateSetting('embeddingModel', e.target.value)}
                className={cn(
                  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-ring'
                )}
              >
                {embeddingModels.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label} {model.free && '(Free)'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Model used for document embeddings. Changes require re-processing all documents.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving} className="min-w-32">
          {saving ? (
            <>
              <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </>
          )}
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={saving}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
