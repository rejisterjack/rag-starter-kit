'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bot, FileText, RefreshCw, Sparkles, User, Zap } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; page: string }[];
  isStreaming?: boolean;
}

const demoMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'What is our refund policy for enterprise clients?',
  },
  {
    id: '2',
    role: 'assistant',
    content: '',
    isStreaming: true,
    sources: [
      { title: 'Refund Policy v3.pdf', page: 'Page 4' },
      { title: 'Enterprise Agreement.docx', page: 'Section 7.2' },
    ],
  },
];

const streamedResponse =
  'According to our Enterprise Agreement (Section 7.2) and Refund Policy, enterprise clients are eligible for a full refund within 30 days of contract signing. After 30 days, refunds are processed pro-rata based on unused service months. The Finance team must approve all enterprise refunds, which typically takes 5-7 business days.';

export function ChatSimulator(): React.ReactElement {
  const [messages, setMessages] = useState<ChatMessage[]>([demoMessages[0]]);
  const [streamingText, setStreamingText] = useState('');
  const [showSources, setShowSources] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const startSimulation = useCallback(() => {
    if (hasStarted) return;
    setHasStarted(true);

    setTimeout(() => {
      setMessages((prev) => [...prev, { ...demoMessages[1] }]);
      setIsTyping(true);

      let charIndex = 0;
      const interval = setInterval(() => {
        if (charIndex <= streamedResponse.length) {
          setStreamingText(streamedResponse.slice(0, charIndex));
          charIndex++;
        } else {
          clearInterval(interval);
          setIsTyping(false);
          setShowSources(true);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === '2' ? { ...m, content: streamedResponse, isStreaming: false } : m
            )
          );
        }
      }, 15);
    }, 800);
  }, [hasStarted]);

  const reset = useCallback(() => {
    setMessages([demoMessages[0]]);
    setStreamingText('');
    setShowSources(false);
    setIsTyping(false);
    setHasStarted(false);
    // Restart slightly delayed to allow exit animation
    setTimeout(startSimulation, 600);
  }, [startSimulation]);

  useEffect(() => {
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && !hasStarted) {
        startSimulation();
      }
    };

    const observer = new IntersectionObserver(handleIntersection, { threshold: 0.5 });
    const element = document.getElementById('chat-simulator');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, [hasStarted, startSimulation]);

  return (
    <section id="chat-simulator" className="py-24 lg:py-32 relative">
      {/* Decorative background glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/5 rounded-[100%] blur-[100px] -z-10 pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            See It in <span className="text-gradient">Action</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Watch a real document query with streaming responses, source citations, and instant
            retrieval.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 40 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          className="max-w-3xl mx-auto"
        >
          {/* Chat Window */}
          <div className="glass-panel rounded-3xl overflow-hidden border border-border/50 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 bg-black/20 backdrop-blur-md z-20 relative">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  {isTyping && (
                    <motion.div
                      className="absolute inset-0 rounded-xl border-2 border-primary"
                      animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground tracking-tight">
                    RAG Assistant
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]" />
                    <span className="text-xs text-muted-foreground/80 font-medium">
                      {isTyping ? 'Generating response...' : 'Online — streaming enabled'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                className="group flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-all px-4 py-2 rounded-full glass-light hover:bg-white/5"
              >
                <RefreshCw className="h-3 w-3 group-hover:rotate-180 transition-transform duration-500" />
                Replay
              </button>
            </div>

            {/* Chat Messages */}
            <div
              ref={scrollRef}
              className="p-6 sm:p-8 space-y-8 min-h-[400px] max-h-[500px] overflow-y-auto scrollbar-thin relative z-10"
            >
              <AnimatePresence mode="popLayout">
                {messages.map((message) => (
                  <motion.div
                    layout
                    key={message.id}
                    initial={{
                      opacity: 0,
                      scale: 0.8,
                      y: 20,
                      transformOrigin: message.role === 'user' ? 'top right' : 'top left',
                    }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Avatar Assistant */}
                    {message.role === 'assistant' && (
                      <div className="shrink-0 h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 mt-1 shadow-lg shadow-primary/10">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                    )}

                    {/* Bubble */}
                    <motion.div
                      layout
                      className={`max-w-[80%] rounded-2xl px-5 py-4 text-[15px] leading-relaxed shadow-md ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'glass-light text-foreground rounded-tl-sm'
                      }`}
                    >
                      {message.role === 'assistant' && message.isStreaming ? (
                        <span>
                          {streamingText}
                          {isTyping && (
                            <motion.span
                              className="inline-block w-2 h-4 bg-primary ml-1.5 align-middle rounded-sm shadow-[0_0_8px_hsl(var(--primary))]"
                              animate={{ opacity: [1, 0.2, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                            />
                          )}
                        </span>
                      ) : (
                        message.content
                      )}
                    </motion.div>

                    {/* Avatar User */}
                    {message.role === 'user' && (
                      <div className="shrink-0 h-10 w-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20 mt-1 backdrop-blur-md">
                        <User className="h-5 w-5 text-white/80" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Source citations */}
              <AnimatePresence>
                {showSources && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                    className="overflow-hidden pl-14" // aligned with assistant text
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        Retrieved Sources
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {demoMessages[1].sources?.map((source, index) => (
                        <motion.div
                          key={source.title}
                          initial={{ opacity: 0, scale: 0.8, x: -10 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          transition={{ delay: index * 0.15, type: 'spring', stiffness: 200 }}
                          whileHover={{ scale: 1.05, y: -2 }}
                          className="flex items-center gap-3 glass-heavy rounded-xl px-4 py-2.5 border border-primary/20 hover:border-primary/50 transition-colors cursor-pointer shadow-lg shadow-black/20 interactive"
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm text-foreground font-semibold">
                              {source.title}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-medium">
                              {source.page}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Chat Input (decorative) */}
            <div className="px-6 py-5 border-t border-border/30 bg-black/20 backdrop-blur-md relative z-20">
              <div className="group flex items-center gap-4 glass-panel rounded-full px-5 py-3 border border-border/50 hover:border-primary/40 transition-colors">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <span className="text-[15px] text-muted-foreground/70 flex-1 font-medium">
                  Ask anything about your documents...
                </span>
                <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center shadow-[0_0_15px_hsl(var(--primary)/0.4)] group-hover:scale-110 transition-transform">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 relative z-20">
              <Link href="/demo" className="w-full sm:w-auto">
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-8 py-3.5 rounded-full font-medium shadow-lg shadow-primary/25"
                >
                  <Sparkles className="h-5 w-5" />
                  Try It Yourself — No Login Required
                </button>
              </Link>
              <Link
                href="https://github.com/rejisterjack/rag-starter-kit"
                target="_blank"
                className="w-full sm:w-auto"
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-2 glass-light hover:bg-white/5 border border-border text-foreground transition-colors px-8 py-3.5 rounded-full font-medium"
                >
                  Clone & Deploy
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
