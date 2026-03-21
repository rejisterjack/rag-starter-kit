# Customizing the UI

Guide for theming, styling, and customizing components in the RAG Starter Kit.

## Overview

The UI is built with:
- **Tailwind CSS 4** - Utility-first styling
- **shadcn/ui** - Component library
- **Framer Motion** - Animations
- **Lucide React** - Icons

## Theme Customization

### CSS Variables

Colors are defined in `app/globals.css`:

```css
@theme {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  
  /* Brand Colors */
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  
  /* Semantic Colors */
  --color-muted: hsl(var(--muted));
  --color-accent: hsl(var(--accent));
  --color-destructive: hsl(var(--destructive));
  --color-success: hsl(var(--success));
  --color-warning: hsl(var(--warning));
}
```

### Color Schemes

#### Light Mode (Default)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --muted: 240 4.8% 95.9%;
  --accent: 240 4.8% 95.9%;
  --destructive: 0 84.2% 60.2%;
  --success: 142 76% 36%;
  --warning: 38 92% 50%;
}
```

#### Dark Mode

```css
.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;
  --muted: 240 3.7% 15.9%;
  --accent: 240 3.7% 15.9%;
}
```

### Custom Color Palette

To create a custom theme:

1. **Generate colors** using tools like:
   - [UI Colors](https://uicolors.app/)
   - [Tailwind Color Generator](https://tailwindcolor.com/)

2. **Update CSS variables**:

```css
/* Custom Blue Theme */
:root {
  --primary: 217 91% 60%;
  --primary-foreground: 0 0% 100%;
  --accent: 213 94% 68%;
  --accent-foreground: 0 0% 100%;
}
```

3. **Add custom colors to Tailwind config**:

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          900: '#1e3a8a',
        },
      },
    },
  },
};
```

## Component Customization

### shadcn/ui Components

Components are in `src/components/ui/` and can be customized directly.

#### Button Example

```typescript
// src/components/ui/button.tsx
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground',
        outline: 'border border-input bg-background',
        // Add custom variant
        brand: 'bg-brand-500 text-white hover:bg-brand-600',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
  }
);
```

### Creating Custom Components

#### Chat Message Component

```typescript
// src/components/chat/message.tsx
'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MarkdownRenderer } from './markdown-renderer';

interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
}

export function Message({ role, content, sources, isStreaming }: MessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex gap-4 p-4',
        role === 'user' ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      <Avatar className={cn(
        'h-8 w-8',
        role === 'user' ? 'bg-primary' : 'bg-muted'
      )}>
        <AvatarFallback>
          {role === 'user' ? 'U' : 'AI'}
        </AvatarFallback>
      </Avatar>
      
      <div className={cn(
        'flex-1 space-y-2 rounded-lg p-4',
        role === 'user' 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-muted'
      )}>
        <MarkdownRenderer content={content} />
        
        {sources && sources.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {sources.map((source, i) => (
              <SourceBadge key={i} source={source} />
            ))}
          </div>
        )}
        
        {isStreaming && <StreamingIndicator />}
      </div>
    </motion.div>
  );
}
```

## Layout Customization

### Chat Interface Layout

```typescript
// src/app/chat/layout.tsx
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/50 hidden md:block">
        <ChatSidebar />
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        <ChatHeader />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
        <ChatInput />
      </main>
    </div>
  );
}
```

### Responsive Design

```typescript
// Mobile-first responsive classes
<div className="
  p-4                    /* Base: small padding */
  md:p-6                 /* Medium screens: more padding */
  lg:p-8                 /* Large screens: even more */
  grid                   /* Base: grid layout */
  grid-cols-1            /* Mobile: single column */
  md:grid-cols-2         /* Tablet: two columns */
  lg:grid-cols-3         /* Desktop: three columns */
  gap-4                  /* Consistent spacing */
">
```

## Animation Customization

### Page Transitions

```typescript
// src/components/page-transition.tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

### Chat Message Animations

```typescript
// Staggered message appearance
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

<motion.div
  variants={containerVariants}
  initial="hidden"
  animate="show"
>
  {messages.map((message) => (
    <motion.div key={message.id} variants={itemVariants}>
      <Message {...message} />
    </motion.div>
  ))}
</motion.div>
```

### Loading States

```typescript
// Skeleton loader for chat
function ChatSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Icon Customization

### Using Lucide Icons

```typescript
import { 
  MessageSquare, 
  FileText, 
  Send,
  Loader2,
  Sparkles,
} from 'lucide-react';

<Button>
  <Send className="mr-2 h-4 w-4" />
  Send Message
</Button>
```

### Custom Icons

```typescript
// src/components/icons/custom-icons.tsx
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}
```

## Dark Mode Implementation

### Theme Provider

```typescript
// src/components/theme-provider.tsx
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

### Theme Toggle

```typescript
// src/components/theme-toggle.tsx
'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
```

## Best Practices

### 1. Use CSS Variables

```css
/* ✅ Good - Uses CSS variables */
.button {
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

/* ❌ Bad - Hardcoded colors */
.button {
  background-color: #3b82f6;
  color: white;
}
```

### 2. Responsive Design First

```typescript
// ✅ Mobile-first
<div className="text-sm md:text-base lg:text-lg">

// ❌ Desktop-first
<div className="text-lg md:text-base sm:text-sm">
```

### 3. Consistent Spacing

```typescript
// Use Tailwind's spacing scale
<div className="p-4 gap-4">     /* 16px */
<div className="p-6 gap-6">     /* 24px */
<div className="p-8 gap-8">     /* 32px */
```

### 4. Animation Performance

```typescript
// ✅ Use transform and opacity
<motion.div
  initial={{ opacity: 0, transform: 'translateY(10px)' }}
  animate={{ opacity: 1, transform: 'translateY(0)' }}
/>

// ❌ Avoid animating layout properties
<motion.div
  initial={{ height: 0 }}
  animate={{ height: 'auto' }}  /* Causes layout thrashing */
/>
```

## Testing UI Changes

### Visual Regression Testing

```bash
# Start Storybook
pnpm storybook

# Run visual tests
pnpm test:e2e --grep "visual"
```

### Responsive Testing

```bash
# Test different viewports
pnpm test:e2e:mobile
```

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/docs)
- [Framer Motion](https://www.framer.com/motion/)
- [Lucide Icons](https://lucide.dev/)
