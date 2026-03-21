'use client';

import { motion, type Variants } from 'framer-motion';
import { Github, Loader2, Mail, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

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

export default function RegisterPage(): React.ReactElement {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters long';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
    if (!/\d/.test(password)) return 'Password must contain at least one number';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Failed to create account');

      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        router.push('/login?registered=true');
      } else {
        router.push('/chat');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // OAuth signup disabled - no GitHub/Google credentials configured
  // const handleOAuthSignUp = (provider: string) => {
  //   setIsLoading(true);
  //   signIn(provider, { callbackUrl: '/chat' });
  // };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemVariants} className="text-center">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent pb-1">
          Create an account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Get started with your next-gen intelligence suite
        </p>
      </motion.div>

      {error && (
        <motion.div
          variants={itemVariants}
          className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive backdrop-blur-sm"
        >
          {error}
        </motion.div>
      )}

      {/* OAuth buttons - temporarily disabled */}
      <motion.div variants={itemVariants} className="space-y-3">
        <Button
          variant="outline"
          disabled
          className="w-full bg-background/30 border-white/5 opacity-50 cursor-not-allowed"
          title="GitHub signup temporarily unavailable"
        >
          <Github className="mr-2 h-4 w-4" />
          Sign up with GitHub
          <span className="ml-2 text-xs text-muted-foreground">(unavailable)</span>
        </Button>
        <Button
          variant="outline"
          disabled
          className="w-full bg-background/30 border-white/5 opacity-50 cursor-not-allowed"
          title="Google signup temporarily unavailable"
        >
          <svg className="mr-2 h-4 w-4 opacity-60" viewBox="0 0 24 24" role="img" aria-label="Google logo">
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
          Sign up with Google
          <span className="ml-2 text-xs text-muted-foreground">(unavailable)</span>
        </Button>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="relative mb-6 mt-2">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full border-border/50" />
          </div>
          <div className="relative flex justify-center text-xs uppercase text-muted-foreground tracking-widest">
            <span className="bg-background/80 px-2 backdrop-blur-xl rounded-full">
              Or sign up with email
            </span>
          </div>
        </div>
      </motion.div>

      <motion.form variants={itemVariants} onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-muted-foreground">
            Full name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10 bg-background/50 border-white/10 focus-visible:ring-primary/50"
              required
              disabled={isLoading}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-muted-foreground">
            Email
          </Label>
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
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-muted-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className="bg-background/50 border-white/10 focus-visible:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground/80 px-1">
              At least 8 items, mixed case & numbers
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-muted-foreground">
              Confirm password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              className="bg-background/50 border-white/10 focus-visible:ring-primary/50"
            />
          </div>
        </div>
        <Button type="submit" className="w-full mt-2 font-medium" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </motion.form>

      <motion.div variants={itemVariants} className="pt-2">
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </motion.div>

      <motion.div variants={itemVariants}>
        <p className="text-center text-xs text-muted-foreground/60 leading-relaxed max-w-[80%] mx-auto">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="hover:text-primary transition-colors">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="hover:text-primary transition-colors">
            Privacy Policy
          </Link>
          .
        </p>
      </motion.div>
    </motion.div>
  );
}
