/**
 * Persistent State Hook
 * 
 * A React hook that persists state to localStorage with:
 * - Automatic serialization/deserialization
 * - Schema validation with Zod
 * - Encryption support for sensitive data
 * - Cross-tab synchronization
 * - Expiration/TTL support
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z, type ZodType } from 'zod';
import { logger } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

interface PersistentStateOptions<T> {
  /** Storage key */
  key: string;
  /** Default value if no stored value exists */
  defaultValue: T;
  /** Zod schema for validation */
  schema?: ZodType<T>;
  /** Encrypt data before storing (for sensitive data) */
  encrypt?: boolean;
  /** Encryption key (required if encrypt is true) */
  encryptionKey?: string;
  /** Time-to-live in milliseconds */
  ttl?: number;
  /** Sync state across browser tabs */
  syncAcrossTabs?: boolean;
  /** Callback when state is updated from another tab */
  onExternalChange?: (newValue: T) => void;
}

interface StoredValue<T> {
  value: T;
  timestamp: number;
  version: number;
}

// =============================================================================
// Encryption Utilities
// =============================================================================

function encryptData(data: string, key: string): string {
  // Simple XOR encryption for demo - use proper encryption in production
  const encrypted = data.split('').map((char, i) => 
    String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
  ).join('');
  return btoa(encrypted);
}

function decryptData(encrypted: string, key: string): string {
  try {
    const data = atob(encrypted);
    return data.split('').map((char, i) => 
      String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
    ).join('');
  } catch {
    throw new Error('Failed to decrypt data');
  }
}

// =============================================================================
// Hook
// =============================================================================

export function usePersistentState<T>(options: PersistentStateOptions<T>) {
  const {
    key,
    defaultValue,
    schema,
    encrypt = false,
    encryptionKey,
    ttl,
    syncAcrossTabs = true,
    onExternalChange,
  } = options;

  const storageKey = useMemo(() => `app:${key}`, [key]);
  const versionRef = useRef(1);
  const isUpdatingRef = useRef(false);

  // Deserialize and validate stored value
  const deserialize = useCallback((stored: string | null): T => {
    if (!stored) return defaultValue;

    try {
      let data: string;
      
      if (encrypt && encryptionKey) {
        data = decryptData(stored, encryptionKey);
      } else {
        data = stored;
      }

      const parsed: StoredValue<T> = JSON.parse(data);

      // Check TTL
      if (ttl && Date.now() - parsed.timestamp > ttl) {
        localStorage.removeItem(storageKey);
        return defaultValue;
      }

      // Validate with schema
      if (schema) {
        const result = schema.safeParse(parsed.value);
        if (!result.success) {
          logger.warn('Persistent state validation failed', { key, errors: result.error.errors });
          return defaultValue;
        }
        return result.data;
      }

      return parsed.value;
    } catch (error) {
      logger.error('Failed to deserialize persistent state', { key, error });
      return defaultValue;
    }
  }, [defaultValue, encrypt, encryptionKey, schema, storageKey, ttl]);

  // Serialize value for storage
  const serialize = useCallback((value: T): string => {
    const data: StoredValue<T> = {
      value,
      timestamp: Date.now(),
      version: versionRef.current++,
    };

    const json = JSON.stringify(data);

    if (encrypt && encryptionKey) {
      return encryptData(json, encryptionKey);
    }

    return json;
  }, [encrypt, encryptionKey]);

  // Initialize state
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    const stored = localStorage.getItem(storageKey);
    return deserialize(stored);
  });

  // Persist state to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isUpdatingRef.current) return;

    try {
      const serialized = serialize(state);
      localStorage.setItem(storageKey, serialized);
    } catch (error) {
      logger.error('Failed to persist state', { key, error });
    }
  }, [state, serialize, storageKey]);

  // Listen for changes from other tabs
  useEffect(() => {
    if (!syncAcrossTabs || typeof window === 'undefined') return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      if (isUpdatingRef.current) return;

      const newValue = deserialize(event.newValue);
      setState(newValue);
      onExternalChange?.(newValue);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [deserialize, onExternalChange, storageKey, syncAcrossTabs]);

  // Update function with batching support
  const updateState = useCallback((
    updater: T | ((prev: T) => T),
    options?: { skipPersistence?: boolean }
  ) => {
    setState(prev => {
      const newValue = typeof updater === 'function' 
        ? (updater as (prev: T) => T)(prev) 
        : updater;

      if (!options?.skipPersistence) {
        try {
          isUpdatingRef.current = true;
          const serialized = serialize(newValue);
          localStorage.setItem(storageKey, serialized);
          
          // Dispatch custom event for same-tab sync
          if (syncAcrossTabs) {
            window.dispatchEvent(new CustomEvent('persistent-state-change', {
              detail: { key: storageKey, value: newValue }
            }));
          }
        } catch (error) {
          logger.error('Failed to update persistent state', { key, error });
        } finally {
          isUpdatingRef.current = false;
        }
      }

      return newValue;
    });
  }, [serialize, storageKey, syncAcrossTabs]);

  // Remove from storage
  const removeState = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(storageKey);
    setState(defaultValue);
  }, [defaultValue, storageKey]);

  // Rehydrate from storage
  const rehydrate = useCallback(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(storageKey);
    setState(deserialize(stored));
  }, [deserialize, storageKey]);

  return {
    state,
    setState: updateState,
    removeState,
    rehydrate,
  };
}

// =============================================================================
// Specialized Hooks
// =============================================================================

/**
 * Hook for chat-related persisted state
 */
export function useChatPreferences() {
  const schema = z.object({
    model: z.string().default('gpt-4o-mini'),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().min(100).max(4000).default(2000),
    streamResponses: z.boolean().default(true),
    showSources: z.boolean().default(true),
    theme: z.enum(['light', 'dark', 'system']).default('system'),
  });

  type ChatPreferences = z.infer<typeof schema>;

  const { state, setState, removeState } = usePersistentState<ChatPreferences>({
    key: 'chat-preferences',
    defaultValue: {
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 2000,
      streamResponses: true,
      showSources: true,
      theme: 'system',
    },
    schema,
    syncAcrossTabs: true,
  });

  return {
    preferences: state,
    setPreferences: setState,
    resetPreferences: removeState,
  };
}

/**
 * Hook for document upload state (survives page reloads)
 */
export function useUploadState() {
  interface UploadProgress {
    fileId: string;
    fileName: string;
    progress: number;
    status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
    error?: string;
  }

  const { state, setState, removeState } = usePersistentState<UploadProgress[]>({
    key: 'upload-progress',
    defaultValue: [],
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  });

  const addUpload = useCallback((upload: Omit<UploadProgress, 'status'>) => {
    setState(prev => [...prev, { ...upload, status: 'pending' }]);
  }, [setState]);

  const updateUpload = useCallback((fileId: string, updates: Partial<UploadProgress>) => {
    setState(prev => 
      prev.map(u => u.fileId === fileId ? { ...u, ...updates } : u)
    );
  }, [setState]);

  const removeUpload = useCallback((fileId: string) => {
    setState(prev => prev.filter(u => u.fileId !== fileId));
  }, [setState]);

  const clearCompleted = useCallback(() => {
    setState(prev => prev.filter(u => u.status !== 'completed'));
  }, [setState]);

  return {
    uploads: state,
    addUpload,
    updateUpload,
    removeUpload,
    clearCompleted,
    clearAll: removeState,
  };
}

/**
 * Hook for user session state (encrypted)
 */
export function useSecureSession() {
  interface SessionData {
    lastActivity: number;
    preferences: Record<string, unknown>;
  }

  const { state, setState, removeState } = usePersistentState<SessionData>({
    key: 'secure-session',
    defaultValue: {
      lastActivity: Date.now(),
      preferences: {},
    },
    encrypt: true,
    encryptionKey: process.env.NEXTAUTH_SECRET || 'default-key-change-in-production',
    ttl: 30 * 60 * 1000, // 30 minutes
    syncAcrossTabs: false, // Security: don't sync sensitive data
  });

  const updateActivity = useCallback(() => {
    setState(prev => ({ ...prev, lastActivity: Date.now() }));
  }, [setState]);

  const isSessionExpired = useCallback(() => {
    return Date.now() - state.lastActivity > 30 * 60 * 1000;
  }, [state.lastActivity]);

  return {
    session: state,
    updateActivity,
    isSessionExpired,
    clearSession: removeState,
  };
}
