'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function MfaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId') ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, userId }),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/chat');
      } else {
        setError(data.error || 'Invalid code');
      }
    } catch {
      setError('Verification failed. Please try again.');
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
              maxLength={6}
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
            disabled={code.length !== 6 || loading}
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
