export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsShell } from '@/components/docs/docs-shell';

export const metadata: Metadata = {
  title: 'Authentication',
  description:
    'Configure OAuth providers, SAML SSO, and API key authentication for the RAG Starter Kit.',
};

function Code({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden mb-4">
      {title && (
        <div className="bg-muted px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border">
          {title}
        </div>
      )}
      <pre className="bg-card p-4 overflow-x-auto text-sm">
        <code>{children}</code>
      </pre>
    </div>
  );
}

export default function AuthenticationPage() {
  return (
    <DocsShell
      path="/docs/guides/authentication"
      title="Authentication"
      description="Auth setup: credentials, OAuth, MFA, and SAML SSO configuration."
      lastModified="2026-08-25"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Authentication</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The kit uses NextAuth.js v5 with multiple authentication strategies: email/password, OAuth
          providers, SAML SSO for enterprise, and API keys for programmatic access.
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-semibold mb-3">Email &amp; Password</h2>
            <p className="text-muted-foreground mb-3">
              Enabled by default. Users sign up with email and password. Passwords are hashed with
              bcrypt. No additional configuration required.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">OAuth Providers</h2>
            <p className="text-muted-foreground mb-3">
              Add social login by configuring OAuth providers. Each provider needs credentials from
              the provider&apos;s developer console.
            </p>

            <h3 className="font-semibold mt-4 mb-2">GitHub OAuth</h3>
            <Code title=".env">{`AUTH_GITHUB_ID=your-github-client-id
AUTH_GITHUB_SECRET=your-github-client-secret`}</Code>
            <p className="text-muted-foreground text-sm">
              Create OAuth App at{' '}
              <a
                href="https://github.com/settings/developers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                github.com/settings/developers
              </a>
              . Set callback URL to{' '}
              <code className="bg-muted px-1 rounded text-sm">
                https://your-domain.com/api/auth/callback/github
              </code>
              .
            </p>

            <h3 className="font-semibold mt-6 mb-2">Google OAuth</h3>
            <Code title=".env">{`AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret`}</Code>
            <p className="text-muted-foreground text-sm">
              Create credentials at{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google Cloud Console
              </a>
              . Authorized redirect URI:{' '}
              <code className="bg-muted px-1 rounded text-sm">
                https://your-domain.com/api/auth/callback/google
              </code>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">SAML SSO (Enterprise)</h2>
            <p className="text-muted-foreground mb-3">
              SAML 2.0 SSO integrates with enterprise identity providers like Okta, Azure AD, and
              OneLogin. Requires the{' '}
              <code className="bg-muted px-1 rounded text-sm">ENCRYPTION_MASTER_KEY</code> env var
              for secure key storage.
            </p>
            <p className="text-muted-foreground mb-3">
              Configuration is done through the admin settings UI. You provide:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm">
              <li>Identity Provider (IdP) metadata URL or XML</li>
              <li>IdP certificate</li>
              <li>Attribute mappings (email, name, groups)</li>
            </ul>
            <div className="bg-muted/50 rounded-lg p-4 border border-border text-sm mt-3">
              <strong>Note:</strong> SAML SSO is a workspace-level setting. Each workspace can
              configure its own IdP.
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">API Keys</h2>
            <p className="text-muted-foreground mb-3">
              Generate API keys for programmatic access to the chat and document APIs. Keys are
              created in the user settings and support scope restrictions.
            </p>
            <Code title="Using an API key">{`curl -X POST https://your-domain.com/api/chat \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello"}'`}</Code>
            <div className="bg-muted/50 rounded-lg p-4 border border-border text-sm mt-3">
              <strong>Security:</strong> API keys are hashed before storage. The full key is shown
              only once at creation. Keys can be revoked at any time from the settings page.
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">Session Management</h2>
            <p className="text-muted-foreground mb-3">
              Sessions use JWT tokens stored in HTTP-only cookies. Configuration:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm">
              <li>
                <strong>NEXTAUTH_SECRET</strong> — Signs and encrypts session cookies (min 32 chars)
              </li>
              <li>
                <strong>NEXTAUTH_URL</strong> — Your app&apos;s public URL for cookie domain and
                redirects
              </li>
              <li>Sessions include fingerprinting to prevent session hijacking</li>
              <li>CSRF protection is enabled by default with double-submit cookies</li>
            </ul>
          </section>

          <div className="flex justify-between pt-4 border-t border-border">
            <Link
              href="/docs/guides/deployment"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Deployment
            </Link>
            <Link
              href="/docs/guides/chrome-extension"
              className="text-sm text-primary hover:underline"
            >
              Chrome Extension &rarr;
            </Link>
          </div>
        </div>
      </div>
    </DocsShell>
  );
}
