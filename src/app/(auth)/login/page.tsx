'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { m, type Variants } from 'framer-motion';
import { AlertTriangle, Github, Loader2, Mail } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

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
  jitProvisioning: boolean;
  defaultRole: 'MEMBER' | 'ADMIN' | 'VIEWER';
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 25, stiffness: 120 },
  },
};

export default function LoginPage(): React.ReactElement {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}

function sanitizeRedirectUrl(url: string): string {
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  return '/chat';
}

function LoginContent(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeRedirectUrl(searchParams.get('callbackUrl') || '/chat');
  const error = searchParams.get('error');

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(error);
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [pendingCredentials, setPendingCredentials] = useState<LoginFormData | null>(null);
  const [ssoDetected, setSsoDetected] = useState<DomainLookupResult | null>(null);
  const [isCheckingDomain, setIsCheckingDomain] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const email = watch('email');

  useEffect(() => {
    const checkDomain = async () => {
      if (!email?.includes('@')) {
        setSsoDetected(null);
        return;
      }

      setIsCheckingDomain(true);
      try {
        const response = await fetch(`/api/auth/domain-lookup?email=${encodeURIComponent(email)}`);
        if (response.ok) {
          const result: DomainLookupResult = await response.json();
          setSsoDetected(result);
        }
      } catch (_error: unknown) {
        // Domain SSO check is best-effort
      } finally {
        setIsCheckingDomain(false);
      }
    };

    const timeoutId = setTimeout(checkDomain, 300);
    return () => clearTimeout(timeoutId);
  }, [email]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setLoginError(null);

    try {
      const challengeRes = await fetch('/api/auth/mfa/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      if (challengeRes.status === 401 || challengeRes.status === 423) {
        setLoginError('Invalid email or password');
        return;
      }

      if (challengeRes.ok) {
        const challengeData = (await challengeRes.json()) as {
          mfaRequired?: boolean;
          challengeToken?: string;
        };

        if (challengeData.mfaRequired && challengeData.challengeToken) {
          setPendingCredentials(data);
          setMfaChallengeToken(challengeData.challengeToken);
          return;
        }
      }

      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        if (result.error.includes('MFA_REQUIRED:')) {
          const token = result.error.split('MFA_REQUIRED:')[1];
          setPendingCredentials(data);
          setMfaChallengeToken(token);
          return;
        }
        setLoginError('Invalid email or password');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (_error: unknown) {
      setLoginError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallengeToken || mfaCode.length < 6) return;

    setIsLoading(true);
    setLoginError(null);

    try {
      const verifyRes = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: mfaCode, challengeToken: mfaChallengeToken }),
      });

      const verifyData = (await verifyRes.json()) as {
        success?: boolean;
        completionToken?: string;
        error?: string;
        warning?: string;
      };

      if (!verifyRes.ok || !verifyData.success || !verifyData.completionToken) {
        setLoginError(verifyData.error || 'Invalid code');
        return;
      }

      if (verifyData.warning) {
        toast.warning(verifyData.warning);
      }

      const result = await signIn('credentials', {
        mfaCompletionToken: verifyData.completionToken,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setLoginError('Unable to complete sign in. Please try again.');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setLoginError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSSOSelected = useCallback(
    (method: SSOMethod, workspaceId: string) => {
      setIsLoading(true);
      let redirectUrl: string;
      if (method.type === 'saml') {
        redirectUrl = `/api/auth/saml/${workspaceId}/login?email=${encodeURIComponent(email)}&returnUrl=${encodeURIComponent(callbackUrl)}`;
      } else {
        // Use NextAuth's built-in OAuth for standard providers
        redirectUrl = `/api/auth/signin/${method.id}?workspace=${workspaceId}&callbackUrl=${encodeURIComponent(callbackUrl)}`;
      }
      window.location.href = redirectUrl;
    },
    [email, callbackUrl]
  );

  const handleResendVerification = useCallback(async () => {
    const emailVal = (document.querySelector('input[type="email"]') as HTMLInputElement)?.value;
    if (!emailVal) {
      toast.error('Enter your email address first, then click resend.');
      return;
    }
    setIsResending(true);
    try {
      await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal }),
      });
      toast.success(
        'If that email is registered and unverified, a new verification link has been sent.'
      );
    } catch {
      toast.error('Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  }, []);

  const showSSOOnly = ssoDetected?.forceSSO && ssoDetected.found;

  return (
    <m.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <m.div variants={itemVariants} className="text-center">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent pb-1">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to your account to continue</p>
      </m.div>

      {loginError && (
        <m.div variants={itemVariants}>
          {loginError === 'verification-token-expired' ||
          loginError === 'invalid-verification-token' ||
          loginError === 'invalid-verification-link' ? (
            <Alert className="border-yellow-500/50 bg-yellow-500/10 backdrop-blur-md">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-200">
                {loginError === 'verification-token-expired'
                  ? 'Your verification link has expired.'
                  : 'This verification link is invalid or already used.'}{' '}
                <button
                  type="button"
                  disabled={isResending}
                  className="underline font-medium hover:text-yellow-100 disabled:opacity-50"
                  onClick={handleResendVerification}
                >
                  {isResending ? 'Sending...' : 'Resend verification email'}
                </button>
              </AlertDescription>
            </Alert>
          ) : loginError === 'email-not-verified' ? (
            <Alert className="border-yellow-500/50 bg-yellow-500/10 backdrop-blur-md">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-200">
                Please verify your email before signing in. Check your inbox or{' '}
                <button
                  type="button"
                  disabled={isResending}
                  className="underline font-medium hover:text-yellow-100 disabled:opacity-50"
                  onClick={handleResendVerification}
                >
                  {isResending ? 'sending...' : 'resend the verification email'}
                </button>
                .
              </AlertDescription>
            </Alert>
          ) : (
            <Alert
              variant="destructive"
              className="border-red-500/50 bg-red-500/10 backdrop-blur-md"
            >
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {loginError === 'CredentialsSignin'
                  ? 'Invalid email or password'
                  : loginError === 'OAuthAccountNotLinked'
                    ? 'This email is already registered with a different sign-in method.'
                    : loginError === 'SessionRequired'
                      ? 'You must be signed in to access that page.'
                      : decodeURIComponent(loginError)}
              </AlertDescription>
            </Alert>
          )}
        </m.div>
      )}

      {showSSOOnly && (
        <m.div variants={itemVariants}>
          <Alert className="bg-blue-500/10 border-blue-500/30 backdrop-blur-md text-blue-200">
            <AlertTriangle className="h-4 w-4 text-blue-400" />
            <AlertDescription>
              This workspace requires SSO authentication via {ssoDetected.workspaceName}. Password
              login is disabled.
            </AlertDescription>
          </Alert>
        </m.div>
      )}

      {/* OAuth buttons */}
      <m.div variants={itemVariants} className="space-y-3">
        <Button
          variant="outline"
          className="w-full interactive"
          onClick={() => signIn('github', { callbackUrl })}
        >
          <Github className="mr-2 h-4 w-4" />
          Continue with GitHub
        </Button>
        <Button
          variant="outline"
          className="w-full interactive"
          onClick={() => signIn('google', { callbackUrl })}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" role="img" aria-label="Google logo">
            <title>Google</title>
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
          Continue with Google
        </Button>
      </m.div>

      {(ssoDetected?.found || showSSOOnly) && (
        <m.div variants={itemVariants}>
          {!showSSOOnly && (
            <div className="relative mb-6 mt-2">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase text-muted-foreground tracking-widest">
                <span className="bg-background/80 px-2 backdrop-blur-xl rounded-full">
                  Or continue with SSO
                </span>
              </div>
            </div>
          )}
          <SSOLoginButton
            email={email || ''}
            onSSODetected={setSsoDetected}
            onSSOSelected={handleSSOSelected}
            showAlways={showSSOOnly}
            isLoading={isLoading || isCheckingDomain}
            workspaceName={ssoDetected?.workspaceName}
            workspaceLogo={ssoDetected?.workspaceLogo}
            ssoMethods={ssoDetected?.ssoMethods || []}
          />
        </m.div>
      )}

      {mfaChallengeToken && (
        <m.div variants={itemVariants}>
          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold">Two-Factor Authentication</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app
              {pendingCredentials?.email ? ` for ${pendingCredentials.email}` : ''}
            </p>
          </div>
          <form onSubmit={onMfaSubmit} className="space-y-4">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="text-center text-2xl tracking-widest bg-background/50 border-white/10"
              disabled={isLoading}
              aria-label="MFA code"
              data-testid="mfa-code-input"
            />
            <Button type="submit" className="w-full" disabled={isLoading || mfaCode.length < 6}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify and sign in'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={isLoading}
              onClick={() => {
                setMfaChallengeToken(null);
                setMfaCode('');
                setPendingCredentials(null);
              }}
            >
              Back to login
            </Button>
          </form>
        </m.div>
      )}

      {!showSSOOnly && !mfaChallengeToken && (
        <m.div variants={itemVariants}>
          <div className="relative mb-6 mt-2">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase text-muted-foreground tracking-widest">
              <span className="bg-background/80 px-2 backdrop-blur-xl rounded-full">
                Or continue with email
              </span>
            </div>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-muted-foreground">
                Email
              </Label>
              <div className="relative" suppressHydrationWarning>
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  data-testid="email-input"
                  type="email"
                  placeholder="name@example.com"
                  {...register('email')}
                  className="pl-10 bg-background/50 border-white/10 focus-visible:ring-primary/50"
                  disabled={isLoading}
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
              </div>
              {errors.email && (
                <p id="email-error" className="text-sm text-red-500" role="alert">
                  {errors.email.message}
                </p>
              )}
              {isCheckingDomain && (
                <p className="text-xs text-muted-foreground">
                  <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                  Checking for SSO...
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-muted-foreground">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary/80 hover:text-primary transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                data-testid="password-input"
                type="password"
                placeholder="Enter your password"
                {...register('password')}
                disabled={isLoading}
                aria-invalid={errors.password ? 'true' : 'false'}
                className="bg-background/50 border-white/10 focus-visible:ring-primary/50"
              />
              {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
            </div>
            <Button
              type="submit"
              className="w-full font-medium"
              disabled={isLoading}
              data-testid="login-button"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>
        </m.div>
      )}

      {!showSSOOnly && (
        <m.div variants={itemVariants} className="pt-2">
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Sign up
            </Link>
          </p>
        </m.div>
      )}

      <m.div variants={itemVariants}>
        <p className="text-center text-xs text-muted-foreground leading-relaxed max-w-[80%] mx-auto">
          By continuing, you agree to our{' '}
          <Link href="/terms" className="hover:text-primary transition-colors">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="hover:text-primary transition-colors">
            Privacy Policy
          </Link>
          .
        </p>
      </m.div>
    </m.div>
  );
}

interface SSOLoginButtonProps {
  email: string;
  onSSODetected: (result: DomainLookupResult) => void;
  onSSOSelected: (method: SSOMethod, workspaceId: string) => void;
  showAlways?: boolean;
  isLoading?: boolean;
  workspaceName?: string;
  workspaceLogo?: string;
  ssoMethods: SSOMethod[];
}

function SSOLoginButton({
  onSSOSelected,
  isLoading,
  workspaceName,
  workspaceLogo,
  ssoMethods,
}: SSOLoginButtonProps): React.ReactElement | null {
  if (ssoMethods.length === 0) return null;

  const handleClick = () => {
    if (ssoMethods.length === 1) onSSOSelected(ssoMethods[0], ssoMethods[0].id);
  };

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={isLoading}
      className="w-full bg-background/50 backdrop-blur-sm border-white/10 hover:bg-white/5 transition-colors"
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : workspaceLogo ? (
        <Image
          src={workspaceLogo}
          alt="Workspace logo"
          width={16}
          height={16}
          className="mr-2 h-4 w-4 object-contain"
          unoptimized
        />
      ) : (
        <svg
          className="mr-2 h-5 w-5 opacity-70"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          role="img"
          aria-label="Shield icon"
        >
          <title>Shield</title>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      )}
      {workspaceName ? `Sign in with ${workspaceName}` : 'Sign in with SSO'}
    </Button>
  );
}

function LoginSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="text-center">
        <div className="h-8 w-48 mx-auto bg-muted rounded" />
        <div className="h-4 w-64 mx-auto mt-2 bg-muted rounded" />
      </div>
      <div className="h-10 w-full bg-muted rounded" />
      <div className="h-10 w-full bg-muted rounded" />
      <div className="h-10 w-full bg-muted rounded" />
    </div>
  );
}
