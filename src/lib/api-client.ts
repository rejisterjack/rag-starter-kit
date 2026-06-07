import { logger } from '@/lib/logger';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'UNKNOWN';
  }
}

interface ApiClientOptions extends RequestInit {
  timeout?: number;
}

function getCsrfTokenFromMeta(): string | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute('content') || null;
}

function isMutation(method?: string): boolean {
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method?.toUpperCase() || '');
}

function buildHeaders(options?: ApiClientOptions): Headers {
  const headers = new Headers(options?.headers);
  const method = options?.method?.toUpperCase() || 'GET';

  if (isMutation(method)) {
    const csrfToken = getCsrfTokenFromMeta();
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken);
    }
  }

  return headers;
}

function createTimeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

export async function apiClient<T>(url: string, options?: ApiClientOptions): Promise<T> {
  const headers = buildHeaders(options);
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    logger.debug(`API ${options?.method?.toUpperCase() || 'GET'} ${url}`);
  }

  const timeoutMs = options?.timeout ?? 30_000;
  const controller = new AbortController();
  const timeoutSignal = createTimeoutSignal(timeoutMs);

  // Link both user-provided signal and our timeout signal
  const signals: AbortSignal[] = [timeoutSignal];
  if (options?.signal) signals.push(options.signal);
  AbortSignal.any(signals).addEventListener('abort', () => controller.abort(), { once: true });

  const startTime = Date.now();

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers,
    signal: controller.signal,
  });

  const duration = Date.now() - startTime;

  if (isDev) {
    logger.debug(`API ${response.status} ${url} (${duration}ms)`);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const apiError = new ApiError(
      data?.error?.message || data?.details || response.statusText,
      response.status,
      data?.error?.code
    );

    if (isDev) {
      logger.error(`API error ${response.status} ${url}`, {
        status: response.status,
        code: apiError.code,
        duration,
      });
    }

    throw apiError;
  }

  return response.json();
}
