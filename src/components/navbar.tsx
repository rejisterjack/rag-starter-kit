'use client';

import {
  BookOpen,
  ExternalLink,
  Github,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useCallback, useState } from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/** Links shown to logged-out visitors */
const publicNavLinks = [
  { href: '/demo', label: 'Live Demo', icon: Sparkles },
  { href: '/docs', label: 'Docs', icon: BookOpen },
  { href: '/pricing', label: 'Pricing', icon: Sparkles },
  {
    href: 'https://github.com/rejisterjack/rag-starter-kit',
    label: 'GitHub',
    external: true,
    icon: Github,
  },
];

/** Links shown to logged-in users (no demo — they go straight to the app) */
const authNavLinks = [
  { href: '/docs', label: 'Docs', icon: BookOpen },
  { href: '/pricing', label: 'Pricing', icon: Sparkles },
  {
    href: 'https://github.com/rejisterjack/rag-starter-kit',
    label: 'GitHub',
    external: true,
    icon: Github,
  },
];

function getInitials(name: string): string {
  return name
    .split(/[@.\s]+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function NavLink({
  href,
  label,
  external,
  active,
  onClick,
}: {
  href: string;
  label: string;
  external?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      onClick={onClick}
      className={cn(
        'relative px-3 py-1.5 text-sm font-medium transition-colors rounded-full',
        active
          ? 'text-primary bg-primary/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      )}
    >
      {label}
      {external && <span className="sr-only"> (opens in new tab)</span>}
      {active && (
        <span className="absolute inset-0 rounded-full bg-primary/10 -z-10 transition-opacity duration-300" />
      )}
    </Link>
  );
}

export function Navbar(): React.ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const isLoading = status === 'loading';
  const isLoggedIn = !!session?.user;

  const navLinks = isLoggedIn ? authNavLinks : publicNavLinks;
  const isChatPage = pathname?.startsWith('/chat');
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'User';
  const userEmail = session?.user?.email || '';
  const userImage = session?.user?.image || '';

  const handleSignOut = useCallback(() => {
    setIsSigningOut(true);
    signOut({ callbackUrl: '/' }).finally(() => setIsSigningOut(false));
  }, []);

  return (
    <header className="shrink-0 z-50 w-full glass-heavy">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-500 shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-shadow">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <span className="text-gradient font-semibold text-lg tracking-tight">RAG Starter</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                external={link.external}
                active={!link.external && pathname === link.href}
              />
            ))}
          </nav>

          {/* Desktop User Section */}
          <div className="hidden md:flex items-center gap-3">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : isLoggedIn ? (
              <div className="flex items-center gap-3">
                {!isChatPage && (
                  <Button
                    asChild
                    variant="default"
                    size="sm"
                    className="rounded-full px-4 bg-primary/90 hover:bg-primary shadow-md shadow-primary/20 hover:shadow-primary/40 transition-all"
                  >
                    <Link href="/chat">
                      <MessageSquare className="h-4 w-4 mr-1.5" />
                      Open Chat
                    </Link>
                  </Button>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="User menu"
                      aria-haspopup="true"
                      className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <Avatar className="h-8 w-8 border border-border/50">
                        <AvatarImage src={userImage} alt={userName} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                          {getInitials(userName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground">{userName}</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 glass-panel">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium text-foreground">{userName}</p>
                        <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/chat">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Chat
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link href="/docs">
                        <BookOpen className="mr-2 h-4 w-4" />
                        Documentation
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer text-destructive focus:text-destructive"
                      disabled={isSigningOut}
                      onClick={handleSignOut}
                    >
                      {isSigningOut ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="mr-2 h-4 w-4" />
                      )}
                      {isSigningOut ? 'Signing out...' : 'Sign out'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Link
                    href="https://github.com/rejisterjack/rag-starter-kit"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="mr-2 h-4 w-4" />
                    GitHub <span className="sr-only">(opens in new tab)</span>
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="rounded-full bg-primary/90 hover:bg-primary shadow-md shadow-primary/20 hover:shadow-primary/40 transition-all"
                >
                  <Link href="/register">Sign up free</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Toggle navigation menu"
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                >
                  {mobileOpen ? (
                    <X className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[280px] glass-heavy border-l border-border/50 p-0"
              >
                <SheetHeader className="p-6 pb-4">
                  <SheetTitle className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-500 shadow-lg shadow-primary/20">
                      <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-gradient font-semibold text-lg tracking-tight">
                      RAG Starter
                    </span>
                  </SheetTitle>
                </SheetHeader>

                <nav className="px-4 py-2 space-y-1" aria-label="Mobile navigation">
                  {navLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = !link.external && pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        target={link.external ? '_blank' : undefined}
                        rel={link.external ? 'noopener noreferrer' : undefined}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors',
                          isActive
                            ? 'text-primary bg-primary/10'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {link.label}
                        {link.external && (
                          <>
                            <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                            <span className="sr-only"> (opens in new tab)</span>
                          </>
                        )}
                      </Link>
                    );
                  })}
                </nav>

                <div className="mt-4 px-6">
                  <div className="h-px bg-border/50" />
                </div>

                <div className="p-4">
                  {isLoading ? (
                    <div className="py-4 flex justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : isLoggedIn ? (
                    <div className="space-y-3">
                      {!isChatPage && (
                        <Button
                          asChild
                          className="w-full rounded-xl bg-primary/90 hover:bg-primary"
                        >
                          <Link href="/chat" onClick={() => setMobileOpen(false)}>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Open Chat
                          </Link>
                        </Button>
                      )}
                      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/50">
                        <Avatar className="h-9 w-9 border border-border/50">
                          <AvatarImage src={userImage} alt={userName} />
                          <AvatarFallback className="bg-primary/20 text-primary text-xs font-medium">
                            {getInitials(userName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-foreground truncate">
                            {userName}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {userEmail}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        disabled={isSigningOut}
                        className="w-full rounded-xl justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                        onClick={() => {
                          setMobileOpen(false);
                          handleSignOut();
                        }}
                      >
                        {isSigningOut ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut className="mr-2 h-4 w-4" />
                        )}
                        {isSigningOut ? 'Signing out...' : 'Sign out'}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button asChild variant="outline" className="w-full rounded-xl">
                        <Link href="/login" onClick={() => setMobileOpen(false)}>
                          Sign in
                        </Link>
                      </Button>
                      <Button asChild className="w-full rounded-xl bg-primary/90 hover:bg-primary">
                        <Link href="/register" onClick={() => setMobileOpen(false)}>
                          Sign up free
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
