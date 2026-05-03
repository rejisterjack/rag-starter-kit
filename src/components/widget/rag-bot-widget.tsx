'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Bot,
  Loader2,
  LogIn,
  MessageSquare,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRAGBot } from './use-rag-bot';

// =============================================================================
// Suggestion Chips Data
// =============================================================================

const SUGGESTION_CHIPS = [
  'What is rag-starter-kit?',
  'How do I deploy it?',
  'What tech stack does it use?',
  'Is it really free to run?',
  'How does RAG work here?',
];

// =============================================================================
// Safe Markdown Renderer — parses inline markdown into React elements
// =============================================================================

function InlineMarkdown({ text }: { text: string }): React.ReactElement {
  if (!text) return <span />;

  const elements: React.ReactNode[] = [];
  let remaining = text;
  let keyCounter = 0;

  const addKey = () => {
    keyCounter += 1;
    return `md-${keyCounter}`;
  };

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^(.*?)`([^`]+?)`(.*)$/);
    if (codeMatch) {
      const [, before, code, after] = codeMatch;
      if (before) {
        elements.push(
          <span key={addKey()} className="text-sm text-foreground/90">
            {before}
          </span>
        );
      }
      elements.push(
        <code
          key={addKey()}
          className="bg-white/10 px-1 py-0.5 rounded text-xs font-mono text-primary-foreground/90"
        >
          {code}
        </code>
      );
      remaining = after || '';
      continue;
    }

    const boldMatch = remaining.match(/^(.*?)\*\*([^*]+?)\*\*(.*)$/);
    if (boldMatch) {
      const [, before, bold, after] = boldMatch;
      if (before) {
        elements.push(
          <span key={addKey()} className="text-sm text-foreground/90">
            {before}
          </span>
        );
      }
      elements.push(
        <strong key={addKey()} className="font-semibold text-foreground">
          {bold}
        </strong>
      );
      remaining = after || '';
      continue;
    }

    const italicMatch = remaining.match(/^(.*?)\*([^*]+?)\*(.*)$/);
    if (italicMatch) {
      const [, before, italic, after] = italicMatch;
      if (before) {
        elements.push(
          <span key={addKey()} className="text-sm text-foreground/90">
            {before}
          </span>
        );
      }
      elements.push(
        <em key={addKey()} className="italic text-foreground/90">
          {italic}
        </em>
      );
      remaining = after || '';
      continue;
    }

    const linkMatch = remaining.match(/^(.*?)\[([^\]]+?)\]\(([^)]+?)\)(.*)$/);
    if (linkMatch) {
      const [, before, label, url, after] = linkMatch;
      if (before) {
        elements.push(
          <span key={addKey()} className="text-sm text-foreground/90">
            {before}
          </span>
        );
      }
      elements.push(
        <a
          key={addKey()}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm"
        >
          {label}
        </a>
      );
      remaining = after || '';
      continue;
    }

    elements.push(
      <span key={addKey()} className="text-sm text-foreground/90">
        {remaining}
      </span>
    );
    break;
  }

  return <>{elements}</>;
}

function SimpleMarkdown({ text }: { text: string }): React.ReactElement {
  if (!text) return <span />;

  const segments = text.split(/(```[\s\S]*?```)/);
  const nodes: React.ReactNode[] = [];

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const segment = segments[segIdx];
    if (!segment) continue;

    if (segment.startsWith('```')) {
      const code = segment.replace(/```(\w+)?\n?/, '').replace(/```$/, '');
      nodes.push(
        <pre
          key={`code-${segIdx}`}
          className="bg-[#05050a] rounded-lg p-3 overflow-x-auto text-xs font-mono border border-white/10 my-2"
        >
          <code className="text-primary-foreground/90">{code}</code>
        </pre>
      );
      continue;
    }

    const lines = segment.split('\n');
    const lineNodes: React.ReactNode[] = [];
    let lineKey = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        lineNodes.push(<div key={`sp-${segIdx}-${lineKey++}`} className="h-1" />);
        continue;
      }

      if (trimmed.startsWith('### ')) {
        lineNodes.push(
          <h4
            key={`h4-${segIdx}-${lineKey++}`}
            className="text-sm font-semibold text-foreground mt-3 mb-1"
          >
            <InlineMarkdown text={trimmed.slice(4)} />
          </h4>
        );
        continue;
      }
      if (trimmed.startsWith('## ')) {
        lineNodes.push(
          <h3
            key={`h3-${segIdx}-${lineKey++}`}
            className="text-sm font-semibold text-foreground mt-3 mb-1"
          >
            <InlineMarkdown text={trimmed.slice(3)} />
          </h3>
        );
        continue;
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        lineNodes.push(
          <li
            key={`li-${segIdx}-${lineKey++}`}
            className="ml-4 text-sm leading-relaxed text-foreground/90"
          >
            <InlineMarkdown text={trimmed.slice(2)} />
          </li>
        );
        continue;
      }

      lineNodes.push(
        <p key={`p-${segIdx}-${lineKey++}`} className="text-sm leading-relaxed text-foreground/90">
          <InlineMarkdown text={trimmed} />
        </p>
      );
    }

    nodes.push(
      <div key={`seg-${segIdx}`} className="space-y-1">
        {lineNodes}
      </div>
    );
  }

  return <div className="space-y-2">{nodes}</div>;
}

// =============================================================================
// Typing Indicator
// =============================================================================

function TypingIndicator(): React.ReactElement {
  return (
    <div className="flex gap-1 items-center py-2 px-1">
      <motion.div
        className="w-1.5 h-1.5 rounded-full bg-primary/70"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
      />
      <motion.div
        className="w-1.5 h-1.5 rounded-full bg-primary/70"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
      />
      <motion.div
        className="w-1.5 h-1.5 rounded-full bg-primary/70"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
      />
    </div>
  );
}

// =============================================================================
// Styles
// =============================================================================

const SOLID_BG = '#0a0a0f';
const SOLID_BG_SECONDARY = '#0e0e15';
const SOLID_BG_TERTIARY = '#13131c';
const SOLID_BORDER = 'rgba(255,255,255,0.08)';
const SOLID_SHADOW = '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1)';

// =============================================================================
// Inner Widget Content (rendered inside portal)
// =============================================================================

function RAGBotWidgetContent(): React.ReactElement {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  const {
    messages,
    isOpen,
    isStreaming,
    input,
    error,
    setInput,
    setIsOpen,
    sendMessage,
    cancelStreaming,
    clearMessages,
  } = useRAGBot({
    welcomeMessage:
      "Hi! I'm RAG Bot — your expert on rag-starter-kit. Ask me about setup, features, deployment, or anything about this product!",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on any message/streaming change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, setIsOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  useEffect(() => {
    if (!isOpen || window.innerWidth >= 640) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const hasMessages = messages.length > 0;
  const showWelcome = !hasMessages && !isStreaming && !error;

  return (
    <>
      {/* Chat Panel — FIXED outer wrapper (no transforms ever applied) */}
      {isOpen && (
        <div
          className="fixed z-[9999] flex flex-col rounded-2xl overflow-hidden border"
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            width: 'min(calc(100vw - 32px), 420px)',
            height: 'min(520px, calc(100vh - 32px))',
            maxHeight: '80vh',
            background: SOLID_BG,
            borderColor: SOLID_BORDER,
            boxShadow: SOLID_SHADOW,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="flex flex-col h-full"
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-4 py-3.5 border-b shrink-0"
                style={{ background: '#0c0c12', borderColor: SOLID_BORDER }}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    {isStreaming && (
                      <motion.div
                        className="absolute inset-0 rounded-xl border-2 border-primary"
                        animate={{ scale: [1, 1.15, 1], opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground tracking-tight">
                      RAG Bot
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-primary animate-pulse' : 'bg-green-500'}`}
                      />
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {isStreaming
                          ? 'Thinking...'
                          : isAuthenticated
                            ? 'Online — ask me anything'
                            : 'Sign in to chat'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasMessages && (
                    <button
                      onClick={clearMessages}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Clear conversation"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (isStreaming) cancelStreaming();
                      setIsOpen(false);
                    }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                    title="Close chat"
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div
                className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5"
                style={{ background: SOLID_BG }}
              >
                {/* Welcome / Empty State */}
                {showWelcome && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                  >
                    <div className="shrink-0 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 mt-1">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div
                      className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] border"
                      style={{ background: SOLID_BG_SECONDARY, borderColor: SOLID_BORDER }}
                    >
                      <p className="text-sm text-foreground leading-relaxed">
                        Hi! I'm <strong>RAG Bot</strong> — your expert on rag-starter-kit.
                      </p>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        Ask me about setup, features, deployment, or anything about this product!
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Suggestion Chips */}
                {showWelcome && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-wrap gap-2 pl-11"
                  >
                    {SUGGESTION_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => {
                          setInput(chip);
                          setTimeout(() => inputRef.current?.focus(), 0);
                        }}
                        className="px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/10 transition-all border"
                        style={{ background: SOLID_BG_TERTIARY, borderColor: SOLID_BORDER }}
                        type="button"
                      >
                        {chip}
                      </button>
                    ))}
                  </motion.div>
                )}

                {/* Unauthenticated State */}
                {!isAuthenticated && status !== 'loading' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-8 px-4 text-center"
                  >
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-4">
                      <LogIn className="h-6 w-6 text-primary" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">
                      Sign in to chat with RAG Bot
                    </h4>
                    <p className="text-xs text-muted-foreground mb-4 max-w-[240px]">
                      Get instant answers about setup, features, deployment, and more.
                    </p>
                    <div className="flex gap-2">
                      <Link
                        href="/login"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        Sign In
                      </Link>
                      <button
                        onClick={() => {
                          const ctaSection = document.getElementById('open-source-cta');
                          ctaSection?.scrollIntoView({ behavior: 'smooth' });
                          setIsOpen(false);
                        }}
                        className="inline-flex items-center px-4 py-2 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border"
                        style={{ background: SOLID_BG_TERTIARY, borderColor: SOLID_BORDER }}
                        type="button"
                      >
                        Learn More
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Messages */}
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Assistant Avatar */}
                    {msg.role === 'assistant' && (
                      <div className="shrink-0 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 mt-1">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[82%] px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm'
                          : 'text-foreground rounded-2xl rounded-tl-sm border'
                      }`}
                      style={
                        msg.role === 'assistant'
                          ? { background: SOLID_BG_SECONDARY, borderColor: SOLID_BORDER }
                          : undefined
                      }
                    >
                      {msg.role === 'assistant' && msg.isStreaming && !msg.content ? (
                        <TypingIndicator />
                      ) : msg.role === 'assistant' ? (
                        <SimpleMarkdown text={msg.content} />
                      ) : (
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      )}
                    </div>

                    {/* User Avatar */}
                    {msg.role === 'user' && (
                      <div className="shrink-0 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20 mt-1">
                        <User className="h-4 w-4 text-white/70" />
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Error Display */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2 mx-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20"
                  >
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-destructive font-medium">{error}</p>
                      {error.includes('sign in') && (
                        <Link
                          href="/login"
                          className="text-xs text-primary hover:underline mt-1 inline-block"
                        >
                          Go to sign in page
                        </Link>
                      )}
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              {isAuthenticated && (
                <div
                  className="shrink-0 px-4 py-3.5 border-t"
                  style={{ background: '#0c0c12', borderColor: SOLID_BORDER }}
                >
                  <div
                    className="flex items-center gap-2 rounded-full px-1.5 py-1.5 border focus-within:border-primary/40 transition-colors"
                    style={{ background: SOLID_BG_SECONDARY, borderColor: SOLID_BORDER }}
                  >
                    <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center ml-1">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask me about rag-starter-kit..."
                      disabled={isStreaming}
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none min-w-0"
                      aria-label="Type your message"
                    />
                    {isStreaming ? (
                      <button
                        onClick={cancelStreaming}
                        className="shrink-0 h-8 w-8 rounded-full bg-destructive/20 hover:bg-destructive/30 flex items-center justify-center transition-colors"
                        type="button"
                        aria-label="Stop generating"
                      >
                        <Loader2 className="h-4 w-4 text-destructive animate-spin" />
                      </button>
                    ) : (
                      <button
                        onClick={sendMessage}
                        disabled={!input.trim()}
                        className="shrink-0 h-8 w-8 rounded-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:opacity-50 flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-primary/30"
                        type="button"
                        aria-label="Send message"
                      >
                        <Send className="h-4 w-4 text-primary-foreground" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 text-center mt-2 tracking-wide">
                    Powered by RAG Starter Kit · Free models via OpenRouter
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Floating Action Button — FIXED outer wrapper */}
      {!isOpen && (
        <div className="fixed z-[9999]" style={{ position: 'fixed', bottom: 24, right: 24 }}>
          <AnimatePresence>
            <motion.div
              key="fab"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <motion.button
                onClick={() => setIsOpen(true)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center border border-primary/30"
                style={{
                  boxShadow: '0 0 24px rgba(139,92,246,0.4), 0 4px 12px rgba(0,0,0,0.3)',
                }}
                type="button"
                aria-label="Open RAG Bot chat"
              >
                <MessageSquare className="h-6 w-6 text-primary-foreground" />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary/40"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.button>

              {/* Tooltip */}
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg whitespace-nowrap pointer-events-none hidden sm:block border"
                style={{ background: SOLID_BG, borderColor: SOLID_BORDER }}
              >
                <p className="text-xs text-muted-foreground font-medium">Ask RAG Bot</p>
                <div
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 rotate-45 border-r border-t"
                  style={{ background: SOLID_BG, borderColor: SOLID_BORDER }}
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Backdrop (mobile only) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9998] sm:hidden"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// =============================================================================
// Main Widget Component — renders via Portal to document.body
// =============================================================================

export const RAGBotWidget = memo(function RAGBotWidget() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(<RAGBotWidgetContent />, document.body);
});
