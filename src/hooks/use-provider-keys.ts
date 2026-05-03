'use client';

import { useCallback, useEffect, useState } from 'react';

export type ProviderId = 'openrouter' | 'fireworks';

interface ProviderMeta {
  id: ProviderId;
  name: string;
  placeholder: string;
}

export const PROVIDERS: ProviderMeta[] = [
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-v1-...' },
  { id: 'fireworks', name: 'Fireworks AI', placeholder: 'fw_...' },
];

const STORAGE_KEY = 'rag-starter:provider-keys';

type ProviderKeys = Partial<Record<ProviderId, string>>;

function loadKeys(): ProviderKeys {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistKeys(keys: ProviderKeys): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function getProviderKey(provider: ProviderId): string | null {
  return loadKeys()[provider] ?? null;
}

export function getAllProviderKeys(): ProviderKeys {
  return loadKeys();
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}${'•'.repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
}

export function useProviderKeys() {
  const [keys, setKeys] = useState<ProviderKeys>({});

  useEffect(() => {
    setKeys(loadKeys());
  }, []);

  const save = useCallback((provider: ProviderId, key: string) => {
    const updated = { ...loadKeys(), [provider]: key };
    persistKeys(updated);
    setKeys(updated);
  }, []);

  const remove = useCallback((provider: ProviderId) => {
    const updated = { ...loadKeys() };
    delete updated[provider];
    persistKeys(updated);
    setKeys(updated);
  }, []);

  const has = useCallback((provider: ProviderId) => !!keys[provider], [keys]);

  return { keys, save, remove, has };
}
