'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Building2, Shield, Fingerprint } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// =============================================================================
// Types
// =============================================================================

interface SSOMethod {
  type: 'saml' | 'oauth';
  provider?: 'google_workspace' | 'azure_ad' | 'okta' | 'onelogin' | 'auth0' | 'generic_oidc';
  name: string;
  id: string;
}

interface DomainLookupResult {
  found: boolean;
  workspaceId?: string;
  workspaceName?: string;
  workspaceLogo?: string;
  ssoMethods: SSOMethod[];
  forceSSO: boolean;
}

interface SSOLoginButtonProps {
  /** Email address entered by the user */
  email: string;
  /** Callback when SSO is detected and should be shown */
  onSSODetected?: (result: DomainLookupResult) => void;
  /** Callback when user selects SSO login */
  onSSOSelected?: (method: SSOMethod, workspaceId: string) => void;
  /** Whether to show the button even if domain isn't detected */
  showAlways?: boolean;
  /** Custom button text */
  buttonText?: string;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Provider Icons
// =============================================================================

const ProviderIcon = ({ provider, className = 'h-4 w-4' }: { provider?: string; className?: string }) => {
  switch (provider) {
    case 'google_workspace':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
      );
    case 'azure_ad':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#0078D4">
          <path d="M5 3v18l7-3 7 3V3H5zm12 13l-5-2-5 2V5h10v11z" />
        </svg>
      );
    case 'okta':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#007DC1">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
        </svg>
      );
    case 'auth0':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#EB5424">
          <path d="M12 2L2 20h20L12 2zm0 3.5L18.5 18h-13L12 5.5z" />
        </svg>
      );
    default:
      return <Shield className={className} />;
  }
};

// =============================================================================
// Main Component
// =============================================================================

export function SSOLoginButton({
  email,
  onSSODetected,
  onSSOSelected,
  showAlways = false,
  buttonText = 'Sign in with SSO',
  className = '',
}: SSOLoginButtonProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [domainResult, setDomainResult] = useState<DomainLookupResult | null>(null);
  const [showProviderDialog, setShowProviderDialog] = useState(false);

  // Check domain when email changes
  useEffect(() => {
    const checkDomain = async () => {
      if (!email || !email.includes('@')) {
        setDomainResult(null);
        return;
      }

      try {
        const response = await fetch(`/api/auth/domain-lookup?email=${encodeURIComponent(email)}`);
        if (response.ok) {
          const result: DomainLookupResult = await response.json();
          setDomainResult(result);
          
          if (result.found) {
            onSSODetected?.(result);
          }
        }
      } catch (error) {
        console.error('Domain lookup failed:', error);
      }
    };

    const timeoutId = setTimeout(checkDomain, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [email, onSSODetected]);

  // Handle SSO button click
  const handleSSOClick = useCallback(async () => {
    if (!domainResult?.found) {
      // If no domain detected, show dialog for manual selection
      setShowProviderDialog(true);
      return;
    }

    if (domainResult.ssoMethods.length === 1) {
      // Single SSO method - redirect directly
      const method = domainResult.ssoMethods[0];
      handleSSOMethod(method);
    } else {
      // Multiple methods - show selection dialog
      setShowProviderDialog(true);
    }
  }, [domainResult]);

  // Handle specific SSO method selection
  const handleSSOMethod = useCallback((method: SSOMethod) => {
    setIsLoading(true);
    
    const workspaceId = domainResult?.workspaceId;
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    onSSOSelected?.(method, workspaceId);

    // Construct redirect URL
    let redirectUrl: string;
    if (method.type === 'saml') {
      redirectUrl = `/api/auth/saml/${workspaceId}/login?email=${encodeURIComponent(email)}`;
    } else {
      redirectUrl = `/api/auth/oauth/${method.id}?workspace=${workspaceId}`;
    }

    window.location.href = redirectUrl;
  }, [domainResult, email, onSSOSelected]);

  // Don't show if no SSO detected and showAlways is false
  if (!showAlways && !domainResult?.found) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={handleSSOClick}
        disabled={isLoading}
        className={`w-full ${className}`}
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : domainResult?.workspaceLogo ? (
          <img
            src={domainResult.workspaceLogo}
            alt=""
            className="mr-2 h-4 w-4 object-contain"
          />
        ) : domainResult?.found && domainResult.ssoMethods.length === 1 ? (
          <ProviderIcon provider={domainResult.ssoMethods[0].provider} />
        ) : (
          <Building2 className="mr-2 h-4 w-4" />
        )}
        {domainResult?.found && domainResult.workspaceName
          ? `Sign in with ${domainResult.workspaceName}`
          : buttonText}
      </Button>

      {/* Provider Selection Dialog */}
      <Dialog open={showProviderDialog} onOpenChange={setShowProviderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Sign-In Method</DialogTitle>
            <DialogDescription>
              {domainResult?.found
                ? `Select how you want to sign in to ${domainResult.workspaceName}`
                : 'Select your organization\'s sign-in method'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            {domainResult?.found ? (
              // Show detected SSO methods
              domainResult.ssoMethods.map((method) => (
                <Button
                  key={method.id}
                  variant="outline"
                  onClick={() => {
                    setShowProviderDialog(false);
                    handleSSOMethod(method);
                  }}
                  className="w-full justify-start"
                >
                  <ProviderIcon provider={method.provider} className="mr-3 h-5 w-5" />
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{method.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {method.type === 'saml' ? 'SAML SSO' : 'OAuth 2.0'}
                    </span>
                  </div>
                </Button>
              ))
            ) : (
              // Show message when no domain detected
              <div className="text-center py-4 text-muted-foreground">
                <Fingerprint className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p>No SSO configuration found for your email domain.</p>
                <p className="text-sm">
                  Please contact your IT administrator or use email/password login.
                </p>
              </div>
            )}

            {/* Password fallback option if SSO not forced */}
            {!domainResult?.forceSSO && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setShowProviderDialog(false)}
                >
                  Continue with email and password
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// =============================================================================
// Domain Lookup API Route Helper
// =============================================================================

/**
 * Create the domain lookup API route at:
 * /app/api/auth/domain-lookup/route.ts
 * 
 * This should import from @/lib/auth/domain-routing and use lookupDomainCached
 */

// =============================================================================
// Compact SSO Button (for use in headers/toolbars)
// =============================================================================

interface CompactSSOButtonProps {
  workspaceId: string;
  workspaceName: string;
  workspaceLogo?: string;
  onClick?: () => void;
  isLoading?: boolean;
}

export function CompactSSOButton({
  workspaceId,
  workspaceName,
  workspaceLogo,
  onClick,
  isLoading = false,
}: CompactSSOButtonProps): JSX.Element {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isLoading}
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : workspaceLogo ? (
        <img
          src={workspaceLogo}
          alt=""
          className="h-4 w-4 object-contain"
        />
      ) : (
        <Building2 className="h-4 w-4" />
      )}
      <span className="max-w-[150px] truncate">{workspaceName}</span>
    </Button>
  );
}
