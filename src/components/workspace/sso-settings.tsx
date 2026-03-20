'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Save,
  AlertTriangle,
  Building2,
  Users,
  Lock,
  Unlock,
  UserPlus,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// =============================================================================
// Types
// =============================================================================

interface SSOSettingsProps {
  workspaceId: string;
  initialSettings: WorkspaceSSOSettings;
}

interface WorkspaceSSOSettings {
  ssoEnabled: boolean;
  ssoDomains: string[];
  forceSSO: boolean;
  defaultRole: 'MEMBER' | 'ADMIN' | 'VIEWER';
  jitProvisioning: boolean;
  requireEmailVerification: boolean;
  allowAccountLinking: boolean;
  sessionDuration: number;
}

// =============================================================================
// Component
// =============================================================================

export function SSOSettings({
  workspaceId,
  initialSettings,
}: SSOSettingsProps): React.ReactElement {
  const router = useRouter();
  const [settings, setSettings] = useState<WorkspaceSSOSettings>(initialSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState('');

  // Save settings
  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/sso-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setSuccess('SSO settings saved successfully');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsLoading(false);
    }
  };

  // Add domain
  const handleAddDomain = useCallback(() => {
    if (!newDomain || !isValidDomain(newDomain)) {
      setError('Please enter a valid domain');
      return;
    }

    const domain = newDomain.toLowerCase().trim();
    if (settings.ssoDomains.includes(domain)) {
      setError('Domain already added');
      return;
    }

    setSettings({ ...settings, ssoDomains: [...settings.ssoDomains, domain] });
    setNewDomain('');
    setError(null);
  }, [newDomain, settings]);

  // Remove domain
  const handleRemoveDomain = useCallback((domain: string) => {
    setSettings({
      ...settings,
      ssoDomains: settings.ssoDomains.filter((d) => d !== domain),
    });
  }, [settings]);

  // Validate domain format
  const isValidDomain = (domain: string): boolean => {
    const regex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    return regex.test(domain);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* General SSO Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Single Sign-On Settings
            </CardTitle>
            <CardDescription>
              Configure SSO behavior and security policies
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable SSO Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sso-enabled" className="text-base">Enable SSO</Label>
                <p className="text-sm text-muted-foreground">
                  Allow users to sign in via SAML or OAuth providers
                </p>
              </div>
              <Switch
                id="sso-enabled"
                checked={settings.ssoEnabled}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, ssoEnabled: checked })
                }
              />
            </div>

            <Separator />

            {/* Force SSO Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="force-sso" className="text-base">Force SSO</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertTriangle className="h-4 w-4 text-yellow-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>When enabled, password login is disabled for this workspace.</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ensure SSO is properly configured before enabling.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-sm text-muted-foreground">
                  Disallow password login - SSO required
                </p>
              </div>
              <Switch
                id="force-sso"
                checked={settings.forceSSO}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, forceSSO: checked })
                }
                disabled={!settings.ssoEnabled}
              />
            </div>

            {settings.forceSSO && (
              <Alert variant="destructive" className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  Force SSO is enabled. Make sure your SSO configuration is working
                  correctly or you may be locked out of the workspace.
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* JIT Provisioning */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label htmlFor="jit-provisioning" className="text-base">
                    Just-In-Time Provisioning
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <UserPlus className="h-4 w-4 text-blue-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Automatically create accounts for new SSO users</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-sm text-muted-foreground">
                  Automatically create accounts for new SSO users
                </p>
              </div>
              <Switch
                id="jit-provisioning"
                checked={settings.jitProvisioning}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, jitProvisioning: checked })
                }
                disabled={!settings.ssoEnabled}
              />
            </div>

            <Separator />

            {/* Account Linking */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="account-linking" className="text-base">
                  Allow Account Linking
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow existing users to link their accounts via SSO
                </p>
              </div>
              <Switch
                id="account-linking"
                checked={settings.allowAccountLinking}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, allowAccountLinking: checked })
                }
                disabled={!settings.ssoEnabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Domain Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Email Domains</CardTitle>
            <CardDescription>
              Configure email domains that will be automatically routed to SSO
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="example.com"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                disabled={!settings.ssoEnabled}
              />
              <Button
                onClick={handleAddDomain}
                disabled={!settings.ssoEnabled || !newDomain}
              >
                Add Domain
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {settings.ssoDomains.map((domain) => (
                <Badge
                  key={domain}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {domain}
                  <button
                    onClick={() => handleRemoveDomain(domain)}
                    className="ml-1 hover:text-destructive"
                    disabled={!settings.ssoEnabled}
                  >
                    ×
                  </button>
                </Badge>
              ))}
              {settings.ssoDomains.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  No domains configured
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Default Role */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Default Role for SSO Users
            </CardTitle>
            <CardDescription>
              Select the default role for new users provisioned via SSO
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={settings.defaultRole}
              onValueChange={(value: 'MEMBER' | 'ADMIN' | 'VIEWER') =>
                setSettings({ ...settings, defaultRole: value })
              }
              disabled={!settings.ssoEnabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Member - Can create and edit content
                  </div>
                </SelectItem>
                <SelectItem value="ADMIN">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Admin - Full workspace access
                  </div>
                </SelectItem>
                <SelectItem value="VIEWER">
                  <div className="flex items-center gap-2">
                    <Unlock className="h-4 w-4" />
                    Viewer - Read-only access
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Session Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Session Settings</CardTitle>
            <CardDescription>
              Configure session duration for SSO users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="session-duration">
                Session Duration: {settings.sessionDuration} hours
              </Label>
              <input
                id="session-duration"
                type="range"
                min="1"
                max="168"
                value={settings.sessionDuration}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    sessionDuration: parseInt(e.target.value, 10),
                  })
                }
                disabled={!settings.ssoEnabled}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 hour</span>
                <span>1 week</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Notice */}
        {settings.ssoEnabled && settings.ssoDomains.length === 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Configure Email Domains</AlertTitle>
            <AlertDescription>
              Add at least one email domain to enable automatic SSO routing for your users.
            </AlertDescription>
          </Alert>
        )}

        {/* Error/Success Messages */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-600 text-green-600">
            <Save className="h-4 w-4" />
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isLoading}
            size="lg"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
