'use client';

import { ArrowRight, Bot, Send, Sparkles, User } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function DemoPage(): React.ReactElement {
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string }>>([
    {
      id: 'welcome-message',
      role: 'assistant',
      content:
        'Hi! I am the demo assistant for the RAG Starter Kit. I have been pre-loaded with the documentation for this project. Ask me anything about how the RAG pipeline works, the architecture, or how to get started!',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    const userMessageId = crypto.randomUUID();
    const newMessages = [...messages, { id: userMessageId, role: 'user', content: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/demo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, stream: false }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to fetch response');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.data.content,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      {/* Header Banner */}
      <div className="bg-primary/10 border-b border-primary/20 p-3 text-center text-sm flex items-center justify-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>This is a public demo powered by a sample knowledge base about this project.</span>
        <Link
          href="/login"
          className="font-semibold text-primary hover:underline ml-2 hidden sm:inline-flex items-center"
        >
          Sign in to use your own documents <ArrowRight className="h-3 w-3 ml-1" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6 w-full max-w-4xl mx-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="shrink-0 h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 mt-1">
                <Bot className="h-5 w-5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-5 py-4 text-[15px] leading-relaxed shadow-md ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'glass-light text-foreground rounded-tl-sm border border-border/50'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center border border-border mt-1">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4 justify-start">
            <div className="shrink-0 h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 mt-1">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div className="glass-light text-foreground rounded-2xl rounded-tl-sm px-5 py-4 border border-border/50 flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-2 h-2 rounded-full bg-primary animate-bounce"
                style={{ animationDelay: '300ms' }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto relative">
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about the RAG Starter Kit..."
              className="w-full bg-muted/50 border border-border rounded-full px-6 py-4 pr-14 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 rounded-full h-10 w-10"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <div className="text-center mt-3 sm:hidden">
            <Link
              href="/login"
              className="text-xs text-primary hover:underline flex items-center justify-center"
            >
              Sign in to use your own documents <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
