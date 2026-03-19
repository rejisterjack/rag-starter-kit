"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Send, Clock, WifiOff, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOfflineStatus, useBackgroundSync } from "@/hooks/use-pwa";
import { cn } from "@/lib/utils";

/**
 * Message queued for offline sending
 */
interface QueuedMessage {
  id: string;
  content: string;
  timestamp: number;
  conversationId?: string;
  attachments?: string[];
}

/**
 * Props for OfflineMessageComposer component
 */
interface OfflineMessageComposerProps {
  /** Callback when a message is sent (online) */
  onSend?: (content: string, options?: { conversationId?: string }) => Promise<void>;
  /** Current conversation ID */
  conversationId?: string;
  /** Custom className */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Auto-focus on mount */
  autoFocus?: boolean;
  /** Minimum message length */
  minLength?: number;
  /** Maximum message length */
  maxLength?: number;
  /** Callback when message is queued offline */
  onQueue?: (message: QueuedMessage) => void;
}

/**
 * Message composer with offline support
 * Queues messages when offline and sends when connection returns
 * 
 * @example
 * ```tsx
 * <OfflineMessageComposer
 *   conversationId={conversationId}
 *   onSend={async (content) => {
 *     await sendMessage(content);
 *   }}
 *   placeholder="Type a message..."
 * />
 * ```
 */
export function OfflineMessageComposer({
  onSend,
  conversationId,
  className,
  placeholder = "Type a message...",
  disabled = false,
  autoFocus = false,
  minLength = 1,
  maxLength = 4000,
  onQueue,
}: OfflineMessageComposerProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<QueuedMessage[]>([]);
  const [showPendingToast, setShowPendingToast] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { isOffline, wasOffline } = useOfflineStatus();
  const { isSupported: isSyncSupported, registerSync } = useBackgroundSync();

  // Load pending messages from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("pwa:pending-messages");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as QueuedMessage[];
        // Filter messages for current conversation
        const relevant = conversationId
          ? parsed.filter((m) => m.conversationId === conversationId)
          : parsed;
        setPendingMessages(relevant);
      } catch {
        // Invalid stored data
      }
    }
  }, [conversationId]);

  // Save pending messages to localStorage
  useEffect(() => {
    if (pendingMessages.length > 0) {
      // Get all messages from other conversations
      const stored = localStorage.getItem("pwa:pending-messages");
      const allMessages: QueuedMessage[] = stored ? JSON.parse(stored) : [];
      const otherMessages = conversationId
        ? allMessages.filter((m) => m.conversationId !== conversationId)
        : [];

      // Merge with current conversation messages
      localStorage.setItem(
        "pwa:pending-messages",
        JSON.stringify([...otherMessages, ...pendingMessages])
      );
    }
  }, [pendingMessages, conversationId]);

  // Send pending messages when coming back online
  useEffect(() => {
    if (wasOffline && !isOffline && pendingMessages.length > 0) {
      void sendPendingMessages();
    }
  }, [wasOffline, isOffline, pendingMessages]);

  // Show pending toast when messages are queued
  useEffect(() => {
    if (pendingMessages.length > 0) {
      setShowPendingToast(true);
      const timer = setTimeout(() => setShowPendingToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [pendingMessages.length]);

  const sendPendingMessages = async () => {
    const messagesToSend = [...pendingMessages];
    const failedMessages: QueuedMessage[] = [];

    for (const message of messagesToSend) {
      try {
        await onSend?.(message.content, { conversationId: message.conversationId });
      } catch {
        failedMessages.push(message);
      }
    }

    setPendingMessages(failedMessages);

    if (failedMessages.length === 0) {
      setShowPendingToast(false);
    }
  };

  const queueMessage = useCallback(
    (messageContent: string) => {
      const message: QueuedMessage = {
        id: crypto.randomUUID(),
        content: messageContent,
        timestamp: Date.now(),
        conversationId,
      };

      setPendingMessages((prev) => [...prev, message]);
      onQueue?.(message);

      // Register for background sync if supported
      if (isSyncSupported) {
        void registerSync("sync-messages");
      }

      return message;
    },
    [conversationId, onQueue, isSyncSupported, registerSync]
  );

  const handleSend = async () => {
    if (!content.trim() || content.trim().length < minLength) return;
    if (content.length > maxLength) return;

    const messageContent = content.trim();
    setContent("");

    if (isOffline) {
      // Queue message for later
      queueMessage(messageContent);
    } else {
      // Send immediately
      setIsSending(true);
      try {
        await onSend?.(messageContent, { conversationId });
      } catch {
        // If send fails, queue for retry
        queueMessage(messageContent);
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleRetry = async (messageId: string) => {
    const message = pendingMessages.find((m) => m.id === messageId);
    if (!message || !onSend) return;

    setPendingMessages((prev) => prev.filter((m) => m.id !== messageId));

    setIsSending(true);
    try {
      await onSend(message.content, { conversationId: message.conversationId });
    } catch {
      // Re-queue if failed
      setPendingMessages((prev) => [...prev, message]);
    } finally {
      setIsSending(false);
    }
  };

  const handleRemovePending = (messageId: string) => {
    setPendingMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  const isValid = content.trim().length >= minLength && content.length <= maxLength;
  const charCount = content.length;

  return (
    <div className={cn("relative", className)}>
      {/* Pending messages indicator */}
      {pendingMessages.length > 0 && (
        <div className="mb-2 rounded-lg border bg-amber-50 p-3 dark:bg-amber-950/30 animate-fade-in">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {pendingMessages.length} message{pendingMessages.length > 1 ? "s" : ""} pending
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {isOffline
                  ? "Will send when you're back online"
                  : "Sending now..."}
              </p>
            </div>
            {isOffline && (
              <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
          </div>

          {/* Pending messages list */}
          <div className="mt-2 space-y-1">
            {pendingMessages.map((message) => (
              <div
                key={message.id}
                className="flex items-center justify-between rounded bg-amber-100/50 px-2 py-1 dark:bg-amber-900/20"
              >
                <span className="truncate text-xs text-amber-800 dark:text-amber-200">
                  {message.content.slice(0, 50)}
                  {message.content.length > 50 ? "..." : ""}
                </span>
                <div className="flex items-center gap-1">
                  {!isOffline && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-amber-700 hover:text-amber-900 dark:text-amber-300"
                      onClick={() => void handleRetry(message.id)}
                      disabled={isSending}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-amber-700 hover:text-amber-900 dark:text-amber-300"
                    onClick={() => handleRemovePending(message.id)}
                  >
                    <span className="sr-only">Remove</span>
                    <span className="text-lg leading-none">&times;</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Offline indicator */}
      {isOffline && (
        <div className="mb-2 overflow-hidden animate-fade-in">
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <WifiOff className="h-3.5 w-3.5" />
            <span>You&apos;re offline. Messages will be queued.</span>
          </div>
        </div>
      )}

      {/* Message input */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSending}
          autoFocus={autoFocus}
          className={cn(
            "min-h-[80px] resize-none pr-14 pb-8",
            isOffline && "border-amber-500/30 focus-visible:ring-amber-500/30"
          )}
          maxLength={maxLength}
        />

        {/* Character count */}
        <div className="absolute bottom-2 left-3 text-xs text-muted-foreground">
          {charCount}/{maxLength}
        </div>

        {/* Send button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="absolute bottom-2 right-2 h-8 w-8"
                disabled={!isValid || disabled || isSending}
                onClick={() => void handleSend()}
              >
                {isSending ? (
                  <Send className="h-4 w-4 animate-pulse" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isOffline ? "Queue message (offline)" : "Send message"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Pending toast notification */}
      {showPendingToast && pendingMessages.length > 0 && (
        <div
          className={cn(
            "absolute -top-12 left-0 right-0 flex justify-center transition-all duration-300",
            showPendingToast ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          )}
        >
          <div className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg">
            <Clock className="h-4 w-4" />
            <span>Message queued for offline sending</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Simple offline-aware input field
 * For single-line inputs with offline support
 */
export function OfflineInput({
  onSend,
  placeholder = "Type a message...",
  disabled = false,
  className,
}: {
  onSend?: (content: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isQueued, setIsQueued] = useState(false);

  const { isOffline } = useOfflineStatus();

  const handleSend = async () => {
    if (!content.trim()) return;

    const messageContent = content.trim();
    setContent("");

    if (isOffline) {
      // Store in localStorage for later
      const pending = JSON.parse(localStorage.getItem("pwa:pending-messages") || "[]");
      pending.push({
        id: crypto.randomUUID(),
        content: messageContent,
        timestamp: Date.now(),
      });
      localStorage.setItem("pwa:pending-messages", JSON.stringify(pending));
      setIsQueued(true);
      setTimeout(() => setIsQueued(false), 3000);
    } else {
      setIsSending(true);
      try {
        await onSend?.(messageContent);
      } finally {
        setIsSending(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void handleSend();
    }
  };

  return (
    <div className={cn("relative flex items-center gap-2", className)}>
      <div className="relative flex-1">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSending}
          className={cn(
            "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            isOffline && "border-amber-500/30 focus-visible:ring-amber-500/30",
            isQueued && "border-green-500/30 focus-visible:ring-green-500/30"
          )}
        />
        {isQueued && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-fade-in">
            <Clock className="h-4 w-4 text-green-500" />
          </div>
        )}
        {isOffline && !isQueued && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <WifiOff className="h-4 w-4 text-amber-500" />
          </div>
        )}
      </div>
      <Button
        size="icon"
        disabled={!content.trim() || disabled || isSending}
        onClick={() => void handleSend()}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Pending messages badge
 * Shows count of messages waiting to be sent
 */
export function PendingMessagesBadge({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  const [count, setCount] = useState(0);
  const { isOffline } = useOfflineStatus();

  useEffect(() => {
    const updateCount = () => {
      const pending = JSON.parse(localStorage.getItem("pwa:pending-messages") || "[]");
      setCount(pending.length);
    };

    updateCount();

    // Update when storage changes
    const handleStorage = () => updateCount();
    window.addEventListener("storage", handleStorage);

    // Also check periodically
    const interval = setInterval(updateCount, 1000);

    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);

  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        isOffline
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        onClick && "cursor-pointer hover:opacity-80",
        className
      )}
    >
      <Clock className="h-3 w-3" />
      {count} pending
    </button>
  );
}
