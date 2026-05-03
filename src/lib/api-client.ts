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

export async function apiClient<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...options });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(
      data?.error?.message || data?.details || response.statusText,
      response.status,
      data?.error?.code
    );
  }

  return response.json();
}
