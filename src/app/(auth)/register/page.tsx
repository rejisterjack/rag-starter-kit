'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, User } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { motion, type Variants } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Separator } from '@/components/ui/separator';

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
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent pb-1">Create an account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Get started with your next-gen intelligence suite
        </p>
      </motion.div>

      {error && (
        <motion.div variants={itemVariants} className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive backdrop-blur-sm">
          {error}
        </motion.div>
      )}

      {/* OAuth buttons disabled - no GitHub/Google credentials configured */}

      <motion.form variants={itemVariants} onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-muted-foreground">Full name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="name" type="text" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} className="pl-10 bg-background/50 border-white/10 focus-visible:ring-primary/50" required disabled={isLoading} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-muted-foreground">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-background/50 border-white/10 focus-visible:ring-primary/50" required disabled={isLoading} />
          </div>
        </div>
        <div className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="password" className="text-muted-foreground">Password</Label>
             <Input id="password" type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} className="bg-background/50 border-white/10 focus-visible:ring-primary/50" />
             <p className="text-xs text-muted-foreground/80 px-1">At least 8 items, mixed case & numbers</p>
           </div>
           <div className="space-y-2">
             <Label htmlFor="confirmPassword" className="text-muted-foreground">Confirm password</Label>
             <Input id="confirmPassword" type="password" placeholder="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={isLoading} className="bg-background/50 border-white/10 focus-visible:ring-primary/50" />
           </div>
        </div>
        <Button type="submit" className="w-full mt-2 font-medium" disabled={isLoading}>
          {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : 'Create account'}
        </Button>
      </motion.form>

      <motion.div variants={itemVariants} className="pt-2">
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:text-primary/80 transition-colors">Sign in</Link>
        </p>
      </motion.div>

      <motion.div variants={itemVariants}>
        <p className="text-center text-xs text-muted-foreground/60 leading-relaxed max-w-[80%] mx-auto">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link> and <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>.
        </p>
      </motion.div>
    </motion.div>
  );
}
