import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from './api';

describe('ApiClient workspace routing', () => {
  it('includes workspaceId in public chat requests when configured', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"done"}\n\n'));
          controller.close();
        },
      }),
    } as Response);

    const client = new ApiClient({
      apiUrl: 'https://example.com',
      apiKey: 'abc',
      workspaceId: 'ws_123',
    });

    await client.sendMessageStream(
      'hello',
      [],
      {
        onToken: () => {},
        onSources: () => {},
        onDone: () => {},
        onError: () => {},
      },
      new AbortController().signal
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body));
    expect(body.workspaceId).toBe('ws_123');

    fetchSpy.mockRestore();
  });
});
