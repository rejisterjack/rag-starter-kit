'use client';

import { Check, Copy, ExternalLink, Plus, Shield, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

// =============================================================================
// Types
// =============================================================================

interface SamlConnection {
  id: string;
  workspaceId: string;
  workspace: {
    name: string;
    slug: string;
  };
  idpEntityId: string | null;
  idpSsoUrl: string | null;
  spEntityId: string;
  spAcsUrl: string | null;
  enabled: boolean;
  allowIdpInitiated: boolean;
  defaultRole: string;
  lastLoginAt: Date | null;
  createdAt: Date;
}

interface WorkspaceOption {
  id: string;
  name: string;
  slug: string;
}

// =============================================================================
// SSO Management Page Component
// =============================================================================

export default function SSOManagementPage(): React.ReactElement {
  const [connections, setConnections] = useState<SamlConnection[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    workspaceId: '',
    idpMetadata: '',
    idpEntityId: '',
    idpSsoUrl: '',
    idpCertificate: '',
    allowIdpInitiated: false,
    defaultRole: 'MEMBER',
  });

  const fetchConnections = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sso/connections');
      if (!response.ok) throw new Error('Failed to fetch SSO connections');
      const data = await response.json();
      setConnections(data.connections);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, []);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/workspaces?withoutSso=true');
      if (!response.ok) throw new Error('Failed to fetch workspaces');
      const data = await response.json();
      setWorkspaces(data.workspaces);
    } catch (_err) {}
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchConnections(), fetchWorkspaces()]);
      setLoading(false);
    };
    loadData();
  }, [fetchConnections, fetchWorkspaces]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/admin/sso/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create SSO connection');
      }

      setDialogOpen(false);
      setFormData({
        workspaceId: '',
        idpMetadata: '',
        idpEntityId: '',
        idpSsoUrl: '',
        idpCertificate: '',
        allowIdpInitiated: false,
        defaultRole: 'MEMBER',
      });
      await fetchConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create connection');
    }
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/sso/connections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) throw new Error('Failed to update connection');
      await fetchConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update connection');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this SSO connection?')) return;

    try {
      const response = await fetch(`/api/admin/sso/connections/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete connection');
      await fetchConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete connection');
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SSO Management</h1>
          <p className="text-muted-foreground mt-2">Configure SAML SSO for workspaces</p>
        </div>
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SSO Management</h1>
          <p className="text-muted-foreground mt-2">
            Configure SAML SSO for workspace authentication
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Connection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create SSO Connection</DialogTitle>
              <DialogDescription>
                Configure SAML SSO for a workspace. You can provide IdP metadata XML or manually
                configure the settings.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace">Workspace</Label>
                <select
                  id="workspace"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.workspaceId}
                  onChange={(e) => setFormData({ ...formData, workspaceId: e.target.value })}
                  required
                >
                  <option value="">Select a workspace</option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name} ({ws.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="idpMetadata">
                  IdP Metadata XML (Optional - will auto-parse configuration)
                </Label>
                <Textarea
                  id="idpMetadata"
                  rows={6}
                  placeholder="Paste your Identity Provider metadata XML here..."
                  value={formData.idpMetadata}
                  onChange={(e) => setFormData({ ...formData, idpMetadata: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="idpEntityId">IdP Entity ID</Label>
                <Input
                  id="idpEntityId"
                  placeholder="https://idp.example.com/entity-id"
                  value={formData.idpEntityId}
                  onChange={(e) => setFormData({ ...formData, idpEntityId: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="idpSsoUrl">IdP SSO URL</Label>
                <Input
                  id="idpSsoUrl"
                  placeholder="https://idp.example.com/saml/sso"
                  value={formData.idpSsoUrl}
                  onChange={(e) => setFormData({ ...formData, idpSsoUrl: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="idpCertificate">IdP Certificate (X.509)</Label>
                <Textarea
                  id="idpCertificate"
                  rows={4}
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  value={formData.idpCertificate}
                  onChange={(e) => setFormData({ ...formData, idpCertificate: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="idpInitiated">Allow IdP-Initiated SSO</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable login initiated from the Identity Provider
                  </p>
                </div>
                <Switch
                  id="idpInitiated"
                  checked={formData.allowIdpInitiated}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, allowIdpInitiated: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="defaultRole">Default Role for New Users</Label>
                <select
                  id="defaultRole"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.defaultRole}
                  onChange={(e) => setFormData({ ...formData, defaultRole: e.target.value })}
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Connection</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md flex items-center justify-between">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Connections List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SAML Connections
          </CardTitle>
          <CardDescription>
            {connections.length} active connection{connections.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No SSO connections configured</p>
              <p className="text-sm mt-1">
                Click &quot;Add Connection&quot; to set up SAML SSO for a workspace
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workspace</TableHead>
                    <TableHead>IdP Entity ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connections.map((conn) => (
                    <TableRow key={conn.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{conn.workspace.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {conn.workspace.slug}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {conn.idpEntityId || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={conn.enabled ? 'success' : 'secondary'}>
                          {conn.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {conn.lastLoginAt
                          ? new Date(conn.lastLoginAt).toLocaleDateString()
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Copy ACS URL */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              copyToClipboard(
                                `${window.location.origin}/api/auth/saml/${conn.workspaceId}/acs`,
                                `acs-${conn.id}`
                              )
                            }
                            title="Copy ACS URL"
                          >
                            {copiedId === `acs-${conn.id}` ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>

                          {/* View Metadata */}
                          <a
                            href={`/api/auth/saml/${conn.workspaceId}/metadata`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="icon" title="View SP Metadata">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>

                          {/* Toggle Enabled */}
                          <Switch
                            checked={conn.enabled}
                            onCheckedChange={(checked) => handleToggleEnabled(conn.id, checked)}
                          />

                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(conn.id)}
                            className="text-destructive hover:text-destructive"
                            title="Delete connection"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Info */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Guide</CardTitle>
          <CardDescription>How to configure SAML SSO for your organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. Identity Provider Setup</h4>
            <p className="text-sm text-muted-foreground">
              In your Identity Provider (Okta, Azure AD, Google Workspace, etc.), create a new SAML
              application and use the SP metadata URL provided for each workspace.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">2. Attribute Mapping</h4>
            <p className="text-sm text-muted-foreground">
              Configure the following attribute mappings in your IdP:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside ml-4">
              <li>
                <code>email</code> - User&apos;s email address (required)
              </li>
              <li>
                <code>name</code> - User&apos;s full name (optional)
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">3. Security Considerations</h4>
            <p className="text-sm text-muted-foreground">
              IdP-initiated SSO is disabled by default for security. Only enable it if your
              organization requires it and you understand the security implications.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
