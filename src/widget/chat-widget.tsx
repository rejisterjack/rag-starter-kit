'use client';

import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface RAGChatWidgetProps {
  apiKey: string;
  apiBaseUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  title?: string;
  placeholder?: string;
  welcomeMessage?: string;
}

interface WidgetMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// =============================================================================
// Inline SVG Icons (zero external deps)
// =============================================================================

function MessageCircleIcon({
  size = 24,
  color = 'currentColor',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Chat"
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

function SendIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Send"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function CloseIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Close"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function BotIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Bot"
    >
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

function UserIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="User"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// =============================================================================
// Theme helpers
// =============================================================================

interface ThemeColors {
  bg: string;
  bgSecondary: string;
  bgBubble: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  inputBg: string;
  inputBorder: string;
  inputFocusBorder: string;
  userBubble: string;
  userBubbleText: string;
  assistantBubble: string;
  assistantBubbleText: string;
  buttonBg: string;
  buttonText: string;
  buttonHover: string;
  shadow: string;
  headerBg: string;
  scrollThumb: string;
}

const LIGHT_THEME: ThemeColors = {
  bg: '#ffffff',
  bgSecondary: '#f9fafb',
  bgBubble: '#6366f1',
  text: '#111827',
  textSecondary: '#374151',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  inputBg: '#f9fafb',
  inputBorder: '#d1d5db',
  inputFocusBorder: '#6366f1',
  userBubble: '#6366f1',
  userBubbleText: '#ffffff',
  assistantBubble: '#f3f4f6',
  assistantBubbleText: '#1f2937',
  buttonBg: '#6366f1',
  buttonText: '#ffffff',
  buttonHover: '#4f46e5',
  shadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
  headerBg: '#6366f1',
  scrollThumb: '#d1d5db',
};

const DARK_THEME: ThemeColors = {
  bg: '#1f2937',
  bgSecondary: '#111827',
  bgBubble: '#6366f1',
  text: '#f9fafb',
  textSecondary: '#e5e7eb',
  textMuted: '#6b7280',
  border: '#374151',
  inputBg: '#111827',
  inputBorder: '#4b5563',
  inputFocusBorder: '#818cf8',
  userBubble: '#6366f1',
  userBubbleText: '#ffffff',
  assistantBubble: '#374151',
  assistantBubbleText: '#f3f4f6',
  buttonBg: '#6366f1',
  buttonText: '#ffffff',
  buttonHover: '#818cf8',
  shadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
  headerBg: '#4f46e5',
  scrollThumb: '#4b5563',
};

function useThemeColors(theme: 'light' | 'dark' | 'auto'): ThemeColors {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (theme === 'auto') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      setIsDark(mql.matches);

      const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else {
      setIsDark(theme === 'dark');
    }
  }, [theme]);

  return isDark ? DARK_THEME : LIGHT_THEME;
}

// =============================================================================
// Streaming fetch helper
// =============================================================================

async function streamChatResponse(
  url: string,
  apiKey: string,
  question: string,
  history: { role: string; content: string }[],
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  signal: AbortSignal
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        question,
        history,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Request failed (${response.status})`;
      try {
        const parsed = JSON.parse(errorText);
        errorMessage = parsed.error || parsed.message || errorMessage;
      } catch (_error: unknown) {
        // Error response wasn't valid JSON — use default error message
      }
      onError(new Error(errorMessage));
      return;
    }

    // Try streaming (ReadableStream / SSE-like)
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        if (signal.aborted) {
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Try to parse as JSON (the public chat API returns a single JSON response)
        // Also handle SSE-style streaming if the API is updated to support it
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const data = JSON.parse(trimmed);

            if (data.type === 'token' && data.content) {
              onToken(data.content);
            } else if (data.type === 'done') {
              onDone();
            } else if (data.type === 'error') {
              onError(new Error(data.message || 'Streaming error'));
              return;
            } else if (data.success === true && data.data?.answer) {
              // Non-streaming JSON response
              onToken(data.data.answer);
              onDone();
              return;
            } else if (data.success === false) {
              onError(new Error(data.error || 'Request failed'));
              return;
            }
          } catch (_error: unknown) {
            // Line wasn't valid JSON — try as SSE payload
            if (trimmed.startsWith('data: ')) {
              const payload = trimmed.slice(6);
              if (payload === '[DONE]') {
                onDone();
                return;
              }
              try {
                const parsed = JSON.parse(payload);
                if (parsed.content) onToken(parsed.content);
                if (parsed.type === 'done') onDone();
              } catch (_error: unknown) {
                // SSE payload wasn't valid JSON — skip
              }
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim());
          if (data.success === true && data.data?.answer) {
            onToken(data.data.answer);
            onDone();
          } else if (data.type === 'token' && data.content) {
            onToken(data.content);
            onDone();
          }
        } catch (_error: unknown) {
          // Remaining buffer wasn't valid JSON — ignore
        }
      }

      onDone();
    } else {
      // Fallback: no streaming body, read as text
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        if (data.success && data.data?.answer) {
          onToken(data.data.answer);
        } else if (data.error) {
          onError(new Error(data.error));
          return;
        }
      } catch (_error: unknown) {
        // Response wasn't JSON — treat as plain text
        onToken(text);
      }
      onDone();
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') return;
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

// =============================================================================
// Main Widget Component
// =============================================================================

export function RAGChatWidget({
  apiKey,
  apiBaseUrl,
  theme = 'auto',
  title = 'AI Assistant',
  placeholder = 'Ask a question...',
  welcomeMessage = 'Hello! How can I help you today?',
}: RAGChatWidgetProps) {
  const baseUrl = apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const colors = useThemeColors(theme);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef('');

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const buildHistory = useCallback((): { role: string; content: string }[] => {
    return messages.map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || isLoading) return;

    setError(null);
    setInput('');

    // Add user message
    const userMsg: WidgetMessage = {
      id: generateId(),
      role: 'user',
      content: question,
    };

    // Add placeholder assistant message
    const assistantMsg: WidgetMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);
    streamingContentRef.current = '';

    const assistantId = assistantMsg.id;
    const chatUrl = `${baseUrl}/api/public/chat`;

    abortRef.current = new AbortController();

    const currentHistory = buildHistory();

    await streamChatResponse(
      chatUrl,
      apiKey,
      question,
      currentHistory,
      // onToken
      (token: string) => {
        streamingContentRef.current += token;
        const content = streamingContentRef.current;
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content } : m)));
      },
      // onDone
      () => {
        setIsLoading(false);
        abortRef.current = null;
      },
      // onError
      (err: Error) => {
        setError(err.message);
        setIsLoading(false);
        // Remove empty assistant message on error
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === assistantId && !last.content) {
            return prev.slice(0, -1);
          }
          return prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || 'Sorry, something went wrong.' }
              : m
          );
        });
        abortRef.current = null;
      },
      abortRef.current.signal
    );
    // biome-ignore lint/correctness/useExhaustiveDependencies: stable refs and callbacks omitted
  }, [input, isLoading, apiKey, baseUrl, buildHistory, generateId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // =============================================================================
  // Styles
  // =============================================================================

  const styles: Record<string, React.CSSProperties> = {
    container: {
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 99999,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    bubble: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      backgroundColor: colors.bgBubble,
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: colors.shadow,
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    },
    panel: {
      position: 'absolute',
      bottom: 72,
      right: 0,
      width: 380,
      height: 540,
      maxHeight: 'calc(100vh - 100px)',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: colors.shadow,
      backgroundColor: colors.bg,
      border: `1px solid ${colors.border}`,
    },
    header: {
      backgroundColor: colors.headerBg,
      color: '#ffffff',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
    },
    headerTitle: {
      fontSize: 15,
      fontWeight: 600,
      margin: 0,
    },
    headerClose: {
      background: 'rgba(255, 255, 255, 0.2)',
      border: 'none',
      borderRadius: 6,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
      color: '#ffffff',
      transition: 'background-color 0.15s ease',
    },
    messagesArea: {
      flex: 1,
      overflowY: 'auto',
      padding: '12px 16px',
      backgroundColor: colors.bgSecondary,
    },
    messageRow: {
      display: 'flex',
      marginBottom: 12,
      alignItems: 'flex-end',
      gap: 8,
    },
    messageRowUser: {
      justifyContent: 'flex-end',
    },
    messageRowAssistant: {
      justifyContent: 'flex-start',
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarUser: {
      backgroundColor: colors.userBubble,
    },
    avatarAssistant: {
      backgroundColor: colors.assistantBubble,
    },
    bubble_user: {
      backgroundColor: colors.userBubble,
      color: colors.userBubbleText,
      padding: '10px 14px',
      borderRadius: '16px 16px 4px 16px',
      maxWidth: '75%',
      fontSize: 14,
      lineHeight: 1.5,
      wordBreak: 'break-word',
      whiteSpace: 'pre-wrap',
    },
    bubble_assistant: {
      backgroundColor: colors.assistantBubble,
      color: colors.assistantBubbleText,
      padding: '10px 14px',
      borderRadius: '16px 16px 16px 4px',
      maxWidth: '75%',
      fontSize: 14,
      lineHeight: 1.5,
      wordBreak: 'break-word',
      whiteSpace: 'pre-wrap',
    },
    welcomeBubble: {
      backgroundColor: colors.assistantBubble,
      color: colors.assistantBubbleText,
      padding: '10px 14px',
      borderRadius: '16px 16px 16px 4px',
      maxWidth: '85%',
      fontSize: 14,
      lineHeight: 1.5,
    },
    inputArea: {
      padding: '12px 16px',
      borderTop: `1px solid ${colors.border}`,
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      backgroundColor: colors.bg,
      flexShrink: 0,
    },
    input: {
      flex: 1,
      padding: '10px 14px',
      borderRadius: 12,
      border: `1px solid ${colors.inputBorder}`,
      backgroundColor: colors.inputBg,
      color: colors.text,
      fontSize: 14,
      outline: 'none',
      fontFamily: 'inherit',
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isLoading ? colors.textMuted : colors.buttonBg,
      color: colors.buttonText,
      border: 'none',
      cursor: isLoading ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      transition: 'background-color 0.15s ease',
    },
    typingIndicator: {
      display: 'flex',
      gap: 4,
      padding: '4px 0',
    },
    typingDot: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      backgroundColor: colors.textMuted,
    },
    errorBubble: {
      backgroundColor: '#fef2f2',
      color: '#991b1b',
      padding: '8px 12px',
      borderRadius: 8,
      fontSize: 13,
      margin: '4px 0',
      border: '1px solid #fecaca',
    },
    poweredBy: {
      textAlign: 'center',
      fontSize: 11,
      color: colors.textMuted,
      padding: '4px 0 2px',
    },
  };

  // =============================================================================
  // Render
  // =============================================================================

  const showWelcome = messages.length === 0 && !error && !isLoading;

  return (
    <div style={styles.container}>
      {/* Chat panel */}
      {isOpen && (
        <div style={styles.panel}>
          {/* Header */}
          <div style={styles.header}>
            <h3 style={styles.headerTitle}>{title}</h3>
            <button
              style={styles.headerClose}
              onClick={() => setIsOpen(false)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
              }}
              aria-label="Close chat"
              type="button"
            >
              <CloseIcon size={18} />
            </button>
          </div>

          {/* Messages */}
          <div style={styles.messagesArea}>
            {/* Welcome message */}
            {showWelcome && (
              <div style={{ ...styles.messageRow, ...styles.messageRowAssistant }}>
                <div style={{ ...styles.avatar, ...styles.avatarAssistant }}>
                  <BotIcon size={16} color={colors.textMuted} />
                </div>
                <div style={styles.welcomeBubble}>{welcomeMessage}</div>
              </div>
            )}

            {/* Message list */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  ...styles.messageRow,
                  ...(msg.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant),
                }}
              >
                {msg.role === 'assistant' && (
                  <div style={{ ...styles.avatar, ...styles.avatarAssistant }}>
                    <BotIcon size={16} color={colors.textMuted} />
                  </div>
                )}
                <div style={msg.role === 'user' ? styles.bubble_user : styles.bubble_assistant}>
                  {msg.content || (
                    <div style={styles.typingIndicator}>
                      <div
                        style={{
                          ...styles.typingDot,
                          animation: 'rag-dot-bounce 1.4s infinite ease-in-out both',
                        }}
                      />
                      <div
                        style={{
                          ...styles.typingDot,
                          animation: 'rag-dot-bounce 1.4s infinite ease-in-out 0.16s both',
                        }}
                      />
                      <div
                        style={{
                          ...styles.typingDot,
                          animation: 'rag-dot-bounce 1.4s infinite ease-in-out 0.32s both',
                        }}
                      />
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div style={{ ...styles.avatar, ...styles.avatarUser }}>
                    <UserIcon size={16} color="#ffffff" />
                  </div>
                )}
              </div>
            ))}

            {/* Error display */}
            {error && <div style={styles.errorBubble}>{error}</div>}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={styles.inputArea}>
            <input
              ref={inputRef}
              style={styles.input}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              aria-label="Type your message"
            />
            <button
              style={styles.sendButton}
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              type="button"
              aria-label="Send message"
              onMouseEnter={(e) => {
                if (!isLoading && input.trim()) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = colors.buttonHover;
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = isLoading
                  ? colors.textMuted
                  : colors.buttonBg;
              }}
            >
              <SendIcon size={18} />
            </button>
          </div>

          {/* Powered by footer */}
          <div style={styles.poweredBy}>Powered by RAG Starter Kit</div>
        </div>
      )}

      {/* Floating bubble button */}
      <button
        style={{
          ...styles.bubble,
          transform: isOpen ? 'rotate(0deg)' : 'rotate(0deg)',
        }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        type="button"
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1.08)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
      >
        {isOpen ? (
          <CloseIcon size={24} color="#ffffff" />
        ) : (
          <MessageCircleIcon size={24} color="#ffffff" />
        )}
      </button>

      {/* Keyframe animation for typing dots - injected via style tag */}
      <style>{`
        @keyframes rag-dot-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
