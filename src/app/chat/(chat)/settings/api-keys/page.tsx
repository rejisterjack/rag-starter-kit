'use client';

import { format } from 'date-fns';
import {
  AlertTriangle,
  Check,
  Copy,
  Key,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Shield,
  Trash2,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { CreateKeyDialog } from '@/components/api-keys/create-key-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { PermissionsSelector } from '@/components/api-keys/permissions-selector';
import { useApiKeys } from '@/hooks/use-api-keys';

// Permission options for the edit modal
const PERMISSION_OPTIONS = [
  {
    id: 'chat:read',
    label: 'Read Chats',
    description: 'View conversation history',
    category: 'chat' as const,
  },
  {
    id: 'chat:write',
    label: 'Send Messages',
    description: 'Send messages and create chats',
    category: 'chat' as const,
  },
  {
    id: 'chat:delete',
    label: 'Delete Chats',
    description: 'Delete conversations',
    category: 'chat' as const,
  },
  {
    id: 'documents:read',
    label: 'Read Documents',
    description: 'View uploaded documents',
    category: 'documents' as const,
  },
  {
    id: 'documents:write',
    label: 'Upload Documents',
    description: 'Upload new documents',
    category: 'documents' as const,
  },
  {
    id: 'documents:delete',
    label: 'Delete Documents',
    description: 'Remove documents',
    category: 'documents' as const,
  },
  {
    id: 'workspaces:read',
    label: 'Read Workspaces',
    description: 'View workspace information',
    category: 'workspaces' as const,
  },
  {
    id: 'workspaces:write',
    label: 'Manage Workspaces',
    description: 'Create and modify workspaces',
    category: 'workspaces' as const,
  },
  {
    id: 'admin:users',
    label: 'Manage Users',
    description: 'Add/remove workspace members',
    category: 'admin' as const,
  },
  {
    id: 'admin:analytics',
    label: 'View Analytics',
    description: 'Access analytics and usage data',
    category: 'admin' as const,
  },
];

interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  createdAt: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  status: 'active' | 'revoked' | 'expired';
  permissions: string[];
  requestCount: number;
}

export default function ApiKeysSettingsPage(): React.ReactElement {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get('workspaceId') || 'default';

  const { apiKeys, isLoading, error, createKey, revokeKey, updateKey, refresh } =
    useApiKeys(workspaceId);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [isKeyRevealModalOpen, setIsKeyRevealModalOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle successful key creation
  const handleCreateKey = useCallback(
    async (data: {
      name: string;
      description?: string;
      permissions: string[];
      expiresIn?: number;
    }) => {
      const result = await createKey(data);
      setNewlyCreatedKey(result.key);
      setIsKeyRevealModalOpen(true);
      return result;
    },
    [createKey]
  );

  // Handle key update
  const handleUpdateKey = useCallback(async () => {
    if (!editingKey) return;

    setIsSubmitting(true);
    try {
      await updateKey(editingKey.id, {
        name: editName,
        permissions: editPermissions,
      });
      setIsEditModalOpen(false);
      setEditingKey(null);
    } catch (_error) {
      // Error is handled by the hook
    } finally {
      setIsSubmitting(false);
    }
  }, [editingKey, editName, editPermissions, updateKey]);

  // Handle key revoke
  const handleRevokeKey = useCallback(async () => {
    if (!revokingKeyId) return;

    setIsSubmitting(true);
    try {
      await revokeKey(revokingKeyId);
      setIsRevokeDialogOpen(false);
      setRevokingKeyId(null);
    } catch (_error) {
      // Error is handled by the hook
    } finally {
      setIsSubmitting(false);
    }
  }, [revokingKeyId, revokeKey]);

  // Open edit modal
  const openEditModal = useCallback((key: ApiKey) => {
    setEditingKey(key);
    setEditName(key.name);
    setEditPermissions(key.permissions);
    setIsEditModalOpen(true);
  }, []);

  // Open revoke dialog
  const openRevokeDialog = useCallback((keyId: string) => {
    setRevokingKeyId(keyId);
    setIsRevokeDialogOpen(true);
  }, []);

  // Copy key to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (_error) {
      toast.error('Failed to copy');
    }
  }, []);

  // Get status badge
  const getStatusBadge = (status: ApiKey['status']) => {
    const variants: Record<typeof status, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      revoked: 'destructive',
      expired: 'secondary',
    };
    const labels: Record<typeof status, string> = {
      active: 'Active',
      revoked: 'Revoked',
      expired: 'Expired',
    };
    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  // Format permissions for display
  const formatPermissions = (permissions: string[]) => {
    if (permissions.length === 0) return 'None';
    if (permissions.length === 1) {
      const perm = PERMISSION_OPTIONS.find((p) => p.id === permissions[0]);
      return perm?.label || permissions[0];
    }
    return `${permissions.length} permissions`;
  };

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Key className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">API Keys</h1>
        </div>
        <p className="text-muted-foreground">
          Manage API keys for programmatic access to your workspace.
        </p>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {apiKeys.length} key{apiKeys.length !== 1 ? 's' : ''} total
          </span>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load API keys.{' '}
            <Button variant="link" className="h-auto p-0" onClick={refresh}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && apiKeys.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Key className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No API keys yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Create an API key to access the RAG API programmatically. API keys can be used to
            authenticate requests from your applications.
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first API key
          </Button>
        </div>
      )}

      {/* API Keys Table */}
      {!isLoading && !error && apiKeys.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apiKeys.map((apiKey) => (
                <TableRow key={apiKey.id}>
                  <TableCell className="font-medium">{apiKey.name}</TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                      {apiKey.keyPreview}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span
                      className="text-sm text-muted-foreground"
                      title={apiKey.permissions.join(', ')}
                    >
                      {formatPermissions(apiKey.permissions)}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {apiKey.lastUsedAt
                      ? format(new Date(apiKey.lastUsedAt), 'MMM d, yyyy')
                      : 'Never'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(apiKey.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>{getStatusBadge(apiKey.status)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => copyToClipboard(apiKey.keyPreview)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Preview
                        </DropdownMenuItem>
                        {apiKey.status === 'active' && (
                          <>
                            <DropdownMenuItem onClick={() => openEditModal(apiKey)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openRevokeDialog(apiKey.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Revoke
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Key Dialog */}
      <CreateKeyDialog
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onCreate={handleCreateKey}
      />

      {/* Key Reveal Modal (shown once after creation) */}
      <Dialog open={isKeyRevealModalOpen} onOpenChange={setIsKeyRevealModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Copy your API key now. You won&apos;t be able to see it again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Store this key securely. For security reasons, we cannot show it again.
              </AlertDescription>
            </Alert>

            <div className="relative">
              <code className="block w-full rounded-lg bg-muted p-4 text-sm break-all font-mono">
                {newlyCreatedKey}
              </code>
              <Button
                size="sm"
                variant="secondary"
                className="absolute right-2 top-2"
                onClick={() => newlyCreatedKey && copyToClipboard(newlyCreatedKey)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsKeyRevealModalOpen(false)}>
              <Check className="mr-2 h-4 w-4" />
              I&apos;ve copied my key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Key Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit API Key</DialogTitle>
            <DialogDescription>Update the name and permissions for this API key.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g., Production API Key"
              />
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="rounded-lg border p-4">
                <PermissionsSelector selected={editPermissions} onChange={setEditPermissions} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateKey}
              disabled={isSubmitting || !editName.trim() || editPermissions.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={isRevokeDialogOpen} onOpenChange={setIsRevokeDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Revoke API Key
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this API key? This action cannot be undone. Any
              applications using this key will no longer be able to access the API.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsRevokeDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevokeKey} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revoking...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Revoke Key
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
