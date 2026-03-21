'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Mail, AlertTriangle } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { motion, type Variants } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/chat';
  const error = searchParams.get('error');

  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(error);
  const [ssoDetected, setSsoDetected] = useState<DomainLookupResult | null>(null);
  const [isCheckingDomain, setIsCheckingDomain] = useState(false);

  useEffect(() => {
    const checkDomain = async () => {
      if (!email || !email.includes('@')) {
        setSsoDetected(null);
        return;
      }

      setIsCheckingDomain(true);
      try {
        const response = await fetch(
          `/api/auth/domain-lookup?email=${encodeURIComponent(email)}`
        );
        if (response.ok) {
          const result: DomainLookupResult = await response.json();
          setSsoDetected(result);
        }
      } catch (error) {
        console.error('Domain lookup failed:', error);
      } finally {
        setIsCheckingDomain(false);
      }
    };

    const timeoutId = setTimeout(checkDomain, 300);
    return () => clearTimeout(timeoutId);
  }, [email]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError(null);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setLoginError('Invalid email or password');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setLoginError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // OAuth login disabled - no GitHub/Google credentials configured
  // const handleOAuthLogin = (provider: string) => {
  //   setIsLoading(true);
  //   signIn(provider, { callbackUrl });
  // };

  const handleSSOSelected = useCallback((method: SSOMethod, workspaceId: string) => {
    setIsLoading(true);
    let redirectUrl: string;
    if (method.type === 'saml') {
      redirectUrl = `/api/auth/saml/${workspaceId}/login?email=${encodeURIComponent(email)}&returnUrl=${encodeURIComponent(callbackUrl)}`;
    } else {
      redirectUrl = `/api/auth/oauth/${method.id}?workspace=${workspaceId}&returnUrl=${encodeURIComponent(callbackUrl)}`;
    }
    window.location.href = redirectUrl;
  }, [email, callbackUrl]);

  const showSSOOnly = ssoDetected?.forceSSO && ssoDetected.found;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemVariants} className="text-center">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent pb-1">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your account to continue
        </p>
      </motion.div>

      {loginError && (
        <motion.div variants={itemVariants}>
          <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 backdrop-blur-md">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {loginError === 'CredentialsSignin'
                ? 'Invalid email or password'
                : decodeURIComponent(loginError)}
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {showSSOOnly && (
        <motion.div variants={itemVariants}>
          <Alert className="bg-blue-500/10 border-blue-500/30 backdrop-blur-md text-blue-200">
            <AlertTriangle className="h-4 w-4 text-blue-400" />
            <AlertDescription>
              This workspace requires SSO authentication via {ssoDetected.workspaceName}.
              Password login is disabled.
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* OAuth buttons disabled - no GitHub/Google credentials configured */}

      {(ssoDetected?.found || showSSOOnly) && (
        <motion.div variants={itemVariants}>
          {!showSSOOnly && (
            <div className="relative mb-6 mt-2">
              <div className="absolute inset-0 flex items-center"><Separator className="w-full border-border/50" /></div>
              <div className="relative flex justify-center text-xs uppercase text-muted-foreground tracking-widest">
                <span className="bg-background/80 px-2 backdrop-blur-xl rounded-full">Or continue with SSO</span>
              </div>
            </div>
          )}
          <SSOLoginButton
            email={email}
            onSSODetected={setSsoDetected}
            onSSOSelected={handleSSOSelected}
            showAlways={showSSOOnly}
            isLoading={isLoading || isCheckingDomain}
            workspaceName={ssoDetected?.workspaceName}
            workspaceLogo={ssoDetected?.workspaceLogo}
            ssoMethods={ssoDetected?.ssoMethods || []}
          />
        </motion.div>
      )}

      {!showSSOOnly && (
        <motion.div variants={itemVariants}>
          <div className="relative mb-6 mt-2">
            <div className="absolute inset-0 flex items-center"><Separator className="w-full border-border/50" /></div>
            <div className="relative flex justify-center text-xs uppercase text-muted-foreground tracking-widest">
              <span className="bg-background/80 px-2 backdrop-blur-xl rounded-full">Or continue with email</span>
            </div>
          </div>
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-muted-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-background/50 border-white/10 focus-visible:ring-primary/50"
                  required
                  disabled={isLoading}
                />
              </div>
              {isCheckingDomain && (
                <p className="text-xs text-muted-foreground"><Loader2 className="inline h-3 w-3 animate-spin mr-1" />Checking for SSO...</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-muted-foreground">Password</Label>
                <Link href="/forgot-password" className="text-xs text-primary/80 hover:text-primary transition-colors">Forgot password?</Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="bg-background/50 border-white/10 focus-visible:ring-primary/50"
              />
            </div>
            <Button type="submit" className="w-full font-medium" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : 'Sign in'}
            </Button>
          </form>
        </motion.div>
      )}

      {!showSSOOnly && (
        <motion.div variants={itemVariants} className="pt-2">
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-primary hover:text-primary/80 transition-colors">Sign up</Link>
          </p>
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <p className="text-center text-xs text-muted-foreground/60 leading-relaxed max-w-[80%] mx-auto">
          By continuing, you agree to our{' '}
          <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>{' '}
          and{' '}
          <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>.
        </p>
      </motion.div>
    </motion.div>
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
    <Button variant="outline" onClick={handleClick} disabled={isLoading} className="w-full bg-background/50 backdrop-blur-sm border-white/10 hover:bg-white/5 transition-colors">
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : workspaceLogo ? (
        <img src={workspaceLogo} alt="" className="mr-2 h-4 w-4 object-contain" />
      ) : (
        <svg className="mr-2 h-5 w-5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
      )}
      {workspaceName ? `Sign in with ${workspaceName}` : 'Sign in with SSO'}
    </Button>
  );
}
