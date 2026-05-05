'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Github,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const navLinks = [
  { href: '/demo', label: 'Live Demo' },
  { href: '/docs', label: 'Docs' },
  { href: '/pricing', label: 'Pricing' },
  { href: 'https://github.com/rejisterjack/rag-starter-kit', label: 'GitHub', external: true },
];

export function Navbar(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const isLoggedIn = !!session?.user;

  return (
    <header className="shrink-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-11 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <span className="font-semibold text-foreground">RAG Starter</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop User Section */}
          <div className="hidden md:flex items-center gap-4">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : isLoggedIn ? (
              <div className="flex items-center gap-3">
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                  <Link href="/chat">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Dashboard
                  </Link>
                </Button>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {session.user?.email?.split('@')[0] || 'User'}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </Button>
              </div>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                  <Link
                    href="https://github.com/rejisterjack/rag-starter-kit"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="mr-2 h-4 w-4" />
                    GitHub
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm" className="rounded-full">
                  <Link href="/register">Sign up free</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={isOpen}
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
          >
            {isOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border bg-background"
          >
            <div className="px-4 py-4 space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  onClick={() => setIsOpen(false)}
                  className="block py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}

              {isLoading ? (
                <div className="py-2">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : isLoggedIn ? (
                <>
                  <Link
                    href="/chat"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {session.user?.email || 'User'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      signOut({ callbackUrl: '/' });
                    }}
                    className="w-full flex items-center gap-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </>
              ) : (
                <div className="pt-3 border-t border-border space-y-2">
                  <Button asChild variant="outline" className="w-full justify-start">
                    <Link
                      href="https://github.com/rejisterjack/rag-starter-kit"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Github className="mr-2 h-4 w-4" />
                      GitHub
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/login">Sign in</Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link href="/register">Sign up free</Link>
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
