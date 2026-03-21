/**
 * API Test Helpers
 *
 * Utilities for testing API routes.
 */

/**
 * Create a test Request object
 */
export function createTestRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
  } = {}
): Request {
  return new Request(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body,
  });
}

/**
 * Create a test Request with JSON body
 */
export function createTestJSONRequest(
  url: string,
  body: unknown,
  options: {
    method?: string;
    headers?: Record<string, string>;
  } = {}
): Request {
  return createTestRequest(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Create a test Request with FormData
 */
export function createTestFormData(
  url: string,
  formData: FormData,
  options: {
    method?: string;
    headers?: Record<string, string>;
  } = {}
): Request {
  return createTestRequest(url, {
    method: options.method || 'POST',
    headers: options.headers,
    body: formData,
  });
}

/**
 * Parse JSON from a Response
 */
export async function parseJSONResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<T>;
  }
  throw new Error('Response is not JSON');
}

/**
 * Parse stream response chunks
 */
export async function parseStreamResponse(response: Response): Promise<string[]> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response has no body');
  }

  const chunks: string[] = [];
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(decoder.decode(value, { stream: true }));
  }

  return chunks;
}

/**
 * Mock API response for testing
 */
export function mockAPIResponse(
  data: unknown,
  options: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
  } = {}
): Response {
  return new Response(JSON.stringify(data), {
    status: options.status || 200,
    statusText: options.statusText || 'OK',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * Create a streaming API response
 */
export function createMockStreamingResponse(chunks: string[]): Response {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      chunks.forEach((chunk) => {
        controller.enqueue(encoder.encode(chunk));
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

/**
 * Expect JSON response with specific data
 */
export async function expectJSONResponse<T>(
  response: Response,
  expectedData: Partial<T>
): Promise<void> {
  expect(response.headers.get('content-type')).toContain('application/json');
  const data = await response.json();
  expect(data).toMatchObject(expectedData);
}

/**
 * Expect error response
 */
export async function expectErrorResponse(
  response: Response,
  expectedStatus: number,
  expectedError?: string | RegExp
): Promise<void> {
  expect(response.status).toBe(expectedStatus);

  const data = await response.json().catch(() => ({}));

  if (expectedError) {
    if (typeof expectedError === 'string') {
      expect(data.error || data.message || '').toContain(expectedError);
    } else {
      expect(data.error || data.message || '').toMatch(expectedError);
    }
  }
}

/**
 * Expect successful response
 */
export async function expectSuccessResponse(
  response: Response,
  expectedData?: Record<string, unknown>
): Promise<void> {
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(300);

  if (expectedData) {
    const data = await response.json();
    expect(data).toMatchObject(expectedData);
  }
}

/**
 * Create mock headers for API requests
 */
export function createMockHeaders(overrides: Record<string, string> = {}): Headers {
  return new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...overrides,
  });
}

/**
 * Extract rate limit headers from response
 */
export function getRateLimitHeaders(response: Response): {
  limit: number;
  remaining: number;
  reset: Date | null;
} {
  return {
    limit: parseInt(response.headers.get('X-RateLimit-Limit') || '0', 10),
    remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0', 10),
    reset: (() => {
      const resetHeader = response.headers.get('X-RateLimit-Reset');
      return resetHeader ? new Date(resetHeader) : null;
    })(),
  };
}

/**
 * Wait for response with timeout
 */
export async function waitForResponse(
  promise: Promise<Response>,
  timeoutMs: number = 5000
): Promise<Response> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Response timeout')), timeoutMs)
    ),
  ]);
}

/**
 * Create multipart form data for file uploads
 */
export function createMultipartFormData(
  files: Array<{ fieldName: string; file: File }>,
  fields: Record<string, string> = {}
): { formData: FormData; boundary: string } {
  const formData = new FormData();

  // Add fields
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });

  // Add files
  files.forEach(({ fieldName, file }) => {
    formData.append(fieldName, file);
  });

  return { formData, boundary: `----WebKitFormBoundary${Math.random().toString(36).substring(2)}` };
}

/**
 * Create a mock NextRequest for App Router tests
 */
export function createMockNextRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
    cookies?: Record<string, string>;
  } = {}
): Request {
  const request = new Request(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body,
  });

  // Add cookie handling
  if (options.cookies) {
    const cookieHeader = Object.entries(options.cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
    request.headers.set('Cookie', cookieHeader);
  }

  return request;
}

/**
 * Parse SSE (Server-Sent Events) stream
 */
export async function parseSSEStream(
  response: Response
): Promise<Array<{ event?: string; data: string }>> {
  const text = await response.text();
  const events: Array<{ event?: string; data: string }> = [];

  let currentEvent: { event?: string; data: string[] } = { data: [] };

  for (const line of text.split('\n')) {
    if (line.startsWith('event: ')) {
      currentEvent.event = line.slice(7);
    } else if (line.startsWith('data: ')) {
      currentEvent.data.push(line.slice(6));
    } else if (line === '') {
      if (currentEvent.data.length > 0) {
        events.push({
          event: currentEvent.event,
          data: currentEvent.data.join('\n'),
        });
      }
      currentEvent = { data: [] };
    }
  }

  return events;
}

/**
 * Create test authentication header
 */
export function createAuthHeader(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Create test CSRF header
 */
export function createCSRFHeader(token: string): Record<string, string> {
  return {
    'X-CSRF-Token': token,
  };
}

/**
 * Verify CORS headers
 */
export function expectCORSHeaders(response: Response, expectedOrigin: string = '*'): void {
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe(expectedOrigin);
}

/**
 * Create paginated response mock
 */
export function createPaginatedResponse<T>(
  items: T[],
  options: {
    page?: number;
    limit?: number;
    total?: number;
  } = {}
): {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
} {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const total = options.total || items.length;
  const totalPages = Math.ceil(total / limit);

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
