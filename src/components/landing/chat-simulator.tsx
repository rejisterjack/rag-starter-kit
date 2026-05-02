'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Bot, FileText, Sparkles, User, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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

  const startSimulation = useCallback(() => {
    if (hasStarted) return;
    setHasStarted(true);

    // Add assistant message
    setTimeout(() => {
      setMessages((prev) => [...prev, { ...demoMessages[1] }]);
      setIsTyping(true);

      // Start streaming
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
      }, 18);
    }, 600);
  }, [hasStarted]);

  const reset = useCallback(() => {
    setMessages([demoMessages[0]]);
    setStreamingText('');
    setShowSources(false);
    setIsTyping(false);
    setHasStarted(false);
  }, []);

  useEffect(() => {
    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && !hasStarted) {
        startSimulation();
      }
    };

    const observer = new IntersectionObserver(handleIntersection, { threshold: 0.4 });
    const element = document.getElementById('chat-simulator');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, [hasStarted, startSimulation]);

  return (
    <section id="chat-simulator" className="py-24 lg:py-32">
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
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          {/* Chat Window */}
          <div className="glass-heavy rounded-2xl overflow-hidden border border-border/50 shadow-2xl shadow-primary/5">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/50">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">RAG Assistant</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-muted-foreground">
                      Online — streaming enabled
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full glass-light"
              >
                Replay
              </button>
            </div>

            {/* Chat Messages */}
            <div className="p-4 sm:p-6 space-y-6 min-h-[320px]">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Avatar */}
                    {message.role === 'assistant' && (
                      <div className="shrink-0 h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted/50 text-foreground rounded-bl-md'
                      }`}
                    >
                      {message.role === 'assistant' && message.isStreaming ? (
                        <span>
                          {streamingText}
                          {isTyping && (
                            <motion.span
                              className="inline-block w-1.5 h-4 bg-primary ml-1 align-middle rounded-full"
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                            />
                          )}
                        </span>
                      ) : (
                        message.content
                      )}
                    </div>

                    {message.role === 'user' && (
                      <div className="shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Source citations */}
              <AnimatePresence>
                {showSources && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2 mb-3 px-12">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Sources
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 px-12">
                      {demoMessages[1].sources?.map((source, index) => (
                        <motion.div
                          key={source.title}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.15 }}
                          className="flex items-center gap-2 glass-light rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs text-foreground font-medium">
                            {source.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{source.page}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Chat Input (decorative) */}
            <div className="px-4 py-3 border-t border-border/30 bg-background/30">
              <div className="flex items-center gap-3 glass-light rounded-full px-4 py-2.5">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground flex-1">
                  Ask anything about your documents...
                </span>
                <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
