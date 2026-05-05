'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Keyboard } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUT_GROUPS: { title: string; shortcuts: Shortcut[] }[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['⌘K', 'Ctrl+K'], description: 'Open global search' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close dialog / cancel' },
    ],
  },
  {
    title: 'Chat',
    shortcuts: [
      { keys: ['Enter'], description: 'Send message' },
      { keys: ['Shift+Enter'], description: 'New line in message' },
      { keys: ['↑'], description: 'Edit last message (when input empty)' },
      { keys: ['⌘⇧K', 'Ctrl+Shift+K'], description: 'Open extension popup' },
    ],
  },
  {
    title: 'Documents',
    shortcuts: [
      { keys: ['⌘U', 'Ctrl+U'], description: 'Upload document' },
      { keys: ['⌘⇧F', 'Ctrl+Shift+F'], description: 'Search documents' },
    ],
  },
  {
    title: 'Interface',
    shortcuts: [
      { keys: ['⌘/', 'Ctrl+/'], description: 'Toggle sidebar' },
      { keys: ['⌘B', 'Ctrl+B'], description: 'Toggle source panel' },
    ],
  },
];

interface KeyboardShortcutsProps {
  /** If you manage open state externally, pass these. Otherwise the component manages its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function KeyboardShortcuts({ open: controlledOpen, onOpenChange }: KeyboardShortcutsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  // Global ? keydown listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return;

      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg glass border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Keyboard className="h-4 w-4 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5 mt-2"
          >
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {group.title}
                </h3>
                <div className="space-y-1.5">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.description}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm text-foreground/80">{shortcut.description}</span>
                      <div className="flex items-center gap-1.5">
                        {shortcut.keys.map((key) => (
                          <kbd
                            key={key}
                            className="px-2 py-0.5 text-xs font-mono bg-muted border border-border/60
                                       rounded-md text-muted-foreground shadow-sm"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>

        <p className="text-xs text-muted-foreground/60 mt-2 text-center">
          Press{' '}
          <kbd className="px-1.5 py-0.5 text-xs font-mono bg-muted border border-border/60 rounded">
            ?
          </kbd>{' '}
          anywhere to open this dialog
        </p>
      </DialogContent>
    </Dialog>
  );
}

/** Trigger button that can be placed in the chat header */
export function KeyboardShortcutsTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard className="h-4 w-4" />
      </Button>
      <KeyboardShortcuts open={open} onOpenChange={setOpen} />
    </>
  );
}
