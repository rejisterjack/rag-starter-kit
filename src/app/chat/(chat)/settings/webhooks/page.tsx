'use client';

import { Webhook as WebhookIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { WebhookManager } from '@/components/webhooks/webhook-manager';
import { apiFetch } from '@/lib/api-client';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret: string;
  createdAt: Date;
  lastTriggeredAt?: Date;
}

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: string;
  lastTriggeredAt: string | null;
}

export default function WebhooksSettingsPage() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Resolve the current workspace, then load its webhooks
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{
          currentWorkspaceId?: string | null;
          workspaces?: Array<{ id: string }>;
        }>('/api/workspaces');
        const id = data?.currentWorkspaceId ?? data?.workspaces?.[0]?.id;
        if (!cancelled && id) setWorkspaceId(id);
        else if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          toast.error('Failed to resolve workspace');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchWebhooks = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await apiFetch<{ webhooks: WebhookRow[] }>(
        `/api/webhooks?workspaceId=${encodeURIComponent(workspaceId)}&limit=100`
      );
      setWebhooks(
        (data?.webhooks ?? []).map((w) => ({
          id: w.id,
          name: w.name,
          url: w.url,
          events: w.events ?? [],
          isActive: w.status === 'ACTIVE',
          secret: '',
          createdAt: new Date(w.lastTriggeredAt ?? Date.now()),
          lastTriggeredAt: w.lastTriggeredAt ? new Date(w.lastTriggeredAt) : undefined,
        }))
      );
    } catch {
      toast.error('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleCreate = async (input: Omit<WebhookConfig, 'id' | 'createdAt' | 'secret'>) => {
    if (!workspaceId) throw new Error('No workspace available');
    const response = await fetch('/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        url: input.url,
        events: input.events,
        workspaceId,
      }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message || 'Failed to create webhook');
    }
    await fetchWebhooks();
  };

  const handleUpdate = async (id: string, updates: Partial<WebhookConfig>) => {
    const response = await fetch(`/api/webhooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        updates.isActive !== undefined ? { status: updates.isActive ? 'ACTIVE' : 'PAUSED' } : {}
      ),
    });
    if (!response.ok) throw new Error('Failed to update webhook');
    await fetchWebhooks();
  };

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete webhook');
    await fetchWebhooks();
  };

  const handleRegenerateSecret = async (id: string) => {
    const response = await fetch(`/api/webhooks/${id}/regenerate-secret`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to regenerate secret');
    const body = await response.json();
    return body?.data?.secret ?? '';
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <WebhookIcon className="h-6 w-6" />
          Webhooks
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure HTTP endpoints to receive real-time events from this workspace
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace Webhooks</CardTitle>
          <CardDescription>
            Webhooks fire on document, chat, and member events. Use the clock icon to view delivery
            logs for each endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workspaceId ? (
            <WebhookManager
              webhooks={webhooks}
              onCreate={handleCreate}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onRegenerateSecret={handleRegenerateSecret}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
              <p className="text-sm">
                No workspace available. Create a workspace to configure webhooks.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
