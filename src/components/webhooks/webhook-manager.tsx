'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
// import { cn } from '@/lib/utils';

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

interface WebhookManagerProps {
  webhooks: WebhookConfig[];
  onCreate: (webhook: Omit<WebhookConfig, 'id' | 'createdAt' | 'secret'>) => Promise<void>;
  onUpdate: (id: string, updates: Partial<WebhookConfig>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRegenerateSecret: (id: string) => Promise<string>;
}

const AVAILABLE_EVENTS = [
  'chat.created',
  'chat.message_sent',
  'document.uploaded',
  'document.processed',
  'workspace.member_joined',
  'workspace.member_left',
];

export function WebhookManager({
  webhooks,
  onCreate,
  onUpdate,
  onDelete,
  onRegenerateSecret: _onRegenerateSecret,
}: WebhookManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
  });


  const handleCreate = async () => {
    if (!newWebhook.name || !newWebhook.url || newWebhook.events.length === 0) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsCreating(true);
    try {
      await onCreate(newWebhook);
      setNewWebhook({ name: '', url: '', events: [] });
      toast.success('Webhook created');
    } catch (error) {
      toast.error('Failed to create webhook');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleEvent = (event: string) => {
    setNewWebhook((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Create Webhook Dialog */}
      <Dialog>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Webhook
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>
              Configure a webhook to receive real-time events
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="My Webhook"
                value={newWebhook.name}
                onChange={(e) => setNewWebhook((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input
                placeholder="https://example.com/webhook"
                value={newWebhook.url}
                onChange={(e) => setNewWebhook((p) => ({ ...p, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={newWebhook.events.includes(event)}
                      onChange={() => toggleEvent(event)}
                    />
                    {event}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhooks Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Triggered</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {webhooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No webhooks configured
                </TableCell>
              </TableRow>
            ) : (
              webhooks.map((webhook) => (
                <TableRow key={webhook.id}>
                  <TableCell className="font-medium">{webhook.name}</TableCell>
                  <TableCell className="font-mono text-xs">{webhook.url}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map((e) => (
                        <Badge key={e} variant="secondary" className="text-xs">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={webhook.isActive}
                      onCheckedChange={(checked) =>
                        onUpdate(webhook.id, { isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {webhook.lastTriggeredAt
                      ? new Date(webhook.lastTriggeredAt).toLocaleDateString()
                      : 'Never'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(webhook.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default WebhookManager;
