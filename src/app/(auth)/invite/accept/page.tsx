'use client';

import { AlertTriangle, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

// =============================================================================
// Types
// =============================================================================

interface InvitationResponse {
  success: boolean;
  error?: string;
  workspace?: {
    id: string;
    name: string;
  };
}

// =============================================================================
// Main Component (wrapped in Suspense for useSearchParams)
// =============================================================================

export default function InviteAcceptPage(): React.ReactElement {
  return (
    <Suspense fallback={<InviteAcceptLoading />}>
      <InviteAcceptContent />
    </Suspense>
  );
}

// =============================================================================
// Loading State
// =============================================================================

function InviteAcceptLoading(): React.ReactElement {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// =============================================================================
// Content Component
// =============================================================================

function InviteAcceptContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'success' | 'error'>(
    'loading'
  );
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null);

  const checkInvitation = useCallback(async (inviteToken: string) => {
    try {
      const response = await fetch(`/api/invite/validate?token=${encodeURIComponent(inviteToken)}`);
      const data = await response.json();

      if (data.success) {
        setWorkspace(data.workspace);
        setStatus('ready');
      } else {
        setStatus('error');
        setError(data.error || 'Invalid or expired invitation.');
      }
    } catch (_error: unknown) {
      setStatus('error');
      setError('Failed to validate invitation. Please try again.');
    }
  }, []);

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Invalid invitation link. No token provided.');
      return;
    }

    // Check if token is valid
    void checkInvitation(token);
  }, [token, checkInvitation]);

  const handleAccept = async () => {
    if (!token) return;

    setStatus('accepting');

    try {
      const response = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data: InvitationResponse = await response.json();

      if (data.success) {
        setStatus('success');
        // Redirect to workspace after a short delay
        setTimeout(() => {
          router.push('/chat');
          router.refresh();
        }, 2000);
      } else {
        setStatus('error');
        setError(data.error || 'Failed to accept invitation.');
      }
    } catch (_error: unknown) {
      setStatus('error');
      setError('An error occurred. Please try again.');
    }
  };

  // =============================================================================
  // Render States
  // =============================================================================

  // Loading state
  if (status === 'loading') {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Validating Invitation</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please wait while we verify your invitation...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="space-y-6">
        <div className="flex justify-center">
          <XCircle className="h-12 w-12 text-destructive" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold">Invitation Error</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn&apos;t process your invitation.
          </p>
        </div>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="flex justify-center gap-3">
          <Button onClick={() => router.push('/login')} variant="outline">
            Go to Login
          </Button>
          <Button onClick={() => router.push('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <CheckCircle className="h-12 w-12 text-green-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Welcome!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You have successfully joined <strong>{workspace?.name}</strong>.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">Redirecting you to the workspace...</p>
      </div>
    );
  }

  // Ready to accept state
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Workspace Invitation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ve been invited to join a workspace
        </p>
      </div>

      {workspace && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-lg font-semibold">{workspace.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Join this workspace to collaborate with your team.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <Button onClick={handleAccept} className="w-full" disabled={status === 'accepting'}>
          {status === 'accepting' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Accepting...
            </>
          ) : (
            'Accept Invitation'
          )}
        </Button>
        <Button
          onClick={() => router.push('/')}
          variant="outline"
          className="w-full"
          disabled={status === 'accepting'}
        >
          Decline
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        By accepting, you agree to the workspace terms and conditions.
      </p>
    </div>
  );
}
