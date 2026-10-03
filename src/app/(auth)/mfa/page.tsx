'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api-client';

export default function MfaPage() {
  return (
    <Suspense fallback={<MfaSkeleton />}>
      <MfaContent />
    </Suspense>
  );
}

function MfaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeToken = searchParams.get('token') ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeToken) {
      setError('Missing MFA challenge. Please sign in again.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const data = await apiFetch<{
        completionToken?: string;
        warning?: string;
      }>('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, challengeToken }),
      });

      if (!data.completionToken) {
        setError('Invalid code');
        return;
      }

      const result = await signIn('credentials', {
        mfaCompletionToken: data.completionToken,
        redirect: false,
        callbackUrl: '/chat',
      });

      if (result?.error) {
        setError('Unable to complete sign in. Please try again.');
      } else {
        router.push('/chat');
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof ApiError && err.message
          ? err.message
          : 'Verification failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Two-Factor Authentication</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full rounded-md border bg-background px-4 py-3 text-center text-2xl tracking-widest"
              disabled={loading}
            />
          </div>

          {error && <p className="text-center text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={code.length < 6 || loading || !challengeToken}
            className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Use a backup code if you lost your device
        </p>
      </div>
    </div>
  );
}

function MfaSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-6">
        <div className="text-center">
          <div className="h-8 w-64 mx-auto bg-muted animate-pulse rounded" />
          <div className="h-4 w-48 mx-auto mt-2 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-14 w-full bg-muted animate-pulse rounded-md" />
        <div className="h-10 w-full bg-muted animate-pulse rounded-md" />
      </div>
    </div>
  );
}
