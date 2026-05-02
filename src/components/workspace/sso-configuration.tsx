'use client';

import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Shield,
  Upload,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

// =============================================================================
// Types
// =============================================================================

interface SamlConfigurationProps {
  workspaceId: string;
  initialConfig?: SamlConfig | null;
  baseUrl: string;
}

interface SamlConfig {
  id: string;
  spEntityId: string;
  idpEntityId: string;
  entryPoint: string;
  callbackUrl: string;
  logoutUrl?: string;
  wantAssertionsSigned: boolean;
  wantResponseSigned: boolean;
  signatureAlgorithm: string;
  digestAlgorithm: string;
  nameIdFormat: string;
  attributeMapping: {
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    groups?: string;
  };
  active: boolean;
  certificateFingerprint?: string;
}

type ConfigTab = 'metadata' | 'manual';

// =============================================================================
// Component
// =============================================================================

export function SSOConfiguration({
  workspaceId,
  initialConfig,
  baseUrl,
}: SamlConfigurationProps): React.ReactElement {
  const router = useRouter();
  const [config, setConfig] = useState<SamlConfig | null>(initialConfig || null);
  const [activeTab, setActiveTab] = useState<ConfigTab>('metadata');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form state
  const [metadataUrl, setMetadataUrl] = useState('');
  const [metadataXml, setMetadataXml] = useState('');
  const [manualConfig, setManualConfig] = useState({
    idpEntityId: '',
    entryPoint: '',
    logoutUrl: '',
    certificate: '',
  });

  // SP URLs
  const spUrls = {
    metadata: `${baseUrl}/api/auth/saml/${workspaceId}/metadata`,
    acs: `${baseUrl}/api/auth/saml/${workspaceId}/acs`,
    slo: `${baseUrl}/api/auth/saml/${workspaceId}/slo`,
  };

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSuccess('Copied to clipboard');
      setTimeout(() => setSuccess(null), 2000);
    } catch (_error: unknown) {
      setError('Failed to copy');
    }
  }, []);

  // Save configuration
  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload =
        activeTab === 'metadata' ? (metadataUrl ? { metadataUrl } : { metadataXml }) : manualConfig;

      const response = await fetch(`/api/workspaces/${workspaceId}/saml`, {
        method: config ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          spEntityId: `${baseUrl}/api/auth/saml/${workspaceId}`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save configuration');
      }

      const data = await response.json();
      setConfig(data.config);
      setSuccess('SAML configuration saved successfully');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  };

  // Test connection
  const handleTest = async () => {
    if (!config) return;

    setIsTesting(true);
    setError(null);

    try {
      // Open test login in popup
      const testWindow = window.open(
        `/api/auth/saml/${workspaceId}/login?test=true`,
        'saml_test',
        'width=600,height=700'
      );

      // Poll for result
      const checkInterval = setInterval(() => {
        if (testWindow?.closed) {
          clearInterval(checkInterval);
          setIsTesting(false);
          setSuccess('Test completed - check the popup results');
        }
      }, 1000);
    } catch (_error: unknown) {
      setIsTesting(false);
      setError('Failed to open test window');
    }
  };

  // Delete configuration
  const handleDelete = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/saml`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete configuration');
      }

      setConfig(null);
      setShowDeleteDialog(false);
      setSuccess('SAML configuration deleted');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete configuration');
    } finally {
      setIsLoading(false);
    }
  };

  // Download SP metadata
  const downloadMetadata = () => {
    window.open(spUrls.metadata, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SAML SSO Status
          </CardTitle>
          <CardDescription>Configure SAML 2.0 Single Sign-On for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${config?.active ? 'bg-green-500' : 'bg-gray-300'}`}
              />
              <span className="font-medium">{config?.active ? 'Active' : 'Not Configured'}</span>
            </div>
            {config?.active && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                Enabled
              </Badge>
            )}
          </div>

          {config?.active && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Identity Provider</span>
                <span className="font-mono truncate max-w-[300px]">{config.idpEntityId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Certificate Fingerprint</span>
                <span className="font-mono">{config.certificateFingerprint || 'N/A'}</span>
              </div>
            </div>
          )}
        </CardContent>
        {config?.active && (
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={isTesting}>
              {isTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Test Connection
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
              <X className="mr-2 h-4 w-4" />
              Remove
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Service Provider Info */}
      <Card>
        <CardHeader>
          <CardTitle>Service Provider Metadata</CardTitle>
          <CardDescription>Provide this information to your Identity Provider</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>SP Entity ID</Label>
            <div className="flex gap-2">
              <Input value={spUrls.metadata} readOnly />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(spUrls.metadata)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>ACS (Assertion Consumer Service) URL</Label>
            <div className="flex gap-2">
              <Input value={spUrls.acs} readOnly />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(spUrls.acs)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>SLO (Single Logout) URL</Label>
            <div className="flex gap-2">
              <Input value={spUrls.slo} readOnly />
              <Button variant="outline" size="icon" onClick={() => copyToClipboard(spUrls.slo)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={downloadMetadata}>
            <Download className="mr-2 h-4 w-4" />
            Download SP Metadata XML
          </Button>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle>Identity Provider Configuration</CardTitle>
          <CardDescription>Configure your IdP settings</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ConfigTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="metadata">
                <FileText className="mr-2 h-4 w-4" />
                Metadata URL/XML
              </TabsTrigger>
              <TabsTrigger value="manual">
                <Upload className="mr-2 h-4 w-4" />
                Manual Configuration
              </TabsTrigger>
            </TabsList>

            <TabsContent value="metadata" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="metadataUrl">IdP Metadata URL</Label>
                <Input
                  id="metadataUrl"
                  placeholder="https://your-idp.com/metadata.xml"
                  value={metadataUrl}
                  onChange={(e) => setMetadataUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Or paste the metadata XML below</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="metadataXml">IdP Metadata XML</Label>
                <Textarea
                  id="metadataXml"
                  placeholder="Paste SAML metadata XML here..."
                  value={metadataXml}
                  onChange={(e) => setMetadataXml(e.target.value)}
                  className="min-h-[200px] font-mono text-xs"
                />
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="idpEntityId">IdP Entity ID</Label>
                <Input
                  id="idpEntityId"
                  placeholder="https://your-idp.com/entity-id"
                  value={manualConfig.idpEntityId}
                  onChange={(e) =>
                    setManualConfig({ ...manualConfig, idpEntityId: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="entryPoint">SSO URL (Entry Point)</Label>
                <Input
                  id="entryPoint"
                  placeholder="https://your-idp.com/sso"
                  value={manualConfig.entryPoint}
                  onChange={(e) => setManualConfig({ ...manualConfig, entryPoint: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoutUrl">SLO URL (Optional)</Label>
                <Input
                  id="logoutUrl"
                  placeholder="https://your-idp.com/slo"
                  value={manualConfig.logoutUrl}
                  onChange={(e) => setManualConfig({ ...manualConfig, logoutUrl: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="certificate">X.509 Certificate</Label>
                <Textarea
                  id="certificate"
                  placeholder="-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiUMA0GCSqGSIb3Qa..."
                  value={manualConfig.certificate}
                  onChange={(e) =>
                    setManualConfig({ ...manualConfig, certificate: e.target.value })
                  }
                  className="min-h-[150px] font-mono text-xs"
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.refresh()} disabled={isLoading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </CardFooter>
      </Card>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-600 text-green-600">
          <Check className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove SAML Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove SAML SSO configuration? Users will no longer be able
              to sign in via SSO.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
