'use client';

import { useEffect, useState } from 'react';
import { PWAScripts } from '@/components/pwa/pwa-scripts';
import { CsrfTokenScript } from '@/lib/security/csrf';

/**
 * Client-side scripts for PWA and CSRF initialization.
 *
 * The CSP nonce is propagated from the proxy middleware via a short-lived,
 * SameSite cookie (__csp_nonce). This avoids calling headers() in a server
 * component, which would force the entire layout into dynamic rendering mode.
 *
 * The cookie is NOT HttpOnly — the client needs to read it to set the nonce
 * on inline script tags. The nonce only needs to be unguessable by remote
 * attackers (not by same-origin JS), so exposing it to JS is acceptable.
 * An attacker who can execute JS in the page already has XSS and CSP is
 * already bypassed at that point.
 */
function readNonceFromCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(/(?:^|;\s*)__csp_nonce=([^;]*)/);
  return match?.[1] ?? undefined;
}

export function NonceScripts(): React.ReactElement {
  const [nonce, setNonce] = useState<string | undefined>(undefined);

  useEffect(() => {
    setNonce(readNonceFromCookie());
  }, []);

  return (
    <>
      <PWAScripts nonce={nonce} />
      <CsrfTokenScript nonce={nonce} />
    </>
  );
}
