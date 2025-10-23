import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockTransport {
  onmessage?: (message: any, extra?: any) => void;
  onclose?: () => void;
  onerror?: (error: unknown) => void;
  sent: any[] = [];

  start = vi.fn(async () => {});
  send = vi.fn(async (message: any) => {
    this.sent.push(message);
  });
}

const compatIdPattern = /^compat-[0-9a-f]{12}-[0-9a-z]{4,6}$/;

async function readSSEBody(res: Response) {
  const text = await res.text();
  const dataLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data: '));
  return dataLines.map((line) => JSON.parse(line.slice(6)));
}

async function stubState() {
  const stateModule = await import('../src/utils/state.js');
  vi.spyOn(stateModule, 'loadHistory').mockResolvedValue();
  vi.spyOn(stateModule, 'addToHistory').mockImplementation(() => {});
}

function buildToolsCall(overrides: Record<string, unknown> = {}) {
  return {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'vibe_check',
      arguments: {
        goal: 'Ship safely',
        plan: '1) tests 2) deploy',
        ...overrides,
      },
    },
  };
}

describe('JSON-RPC compatibility shim', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.MCP_TRANSPORT;
    delete process.env.MCP_DISCOVERY_MODE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('synthesizes ids for stdio tools/call requests', async () => {
    await stubState();

    const { createMcpServer } = await import('../src/index.js');
    const { wrapTransportForCompatibility } = await import('../src/utils/jsonRpcCompat.js');

    const server = await createMcpServer();
    const transport = wrapTransportForCompatibility(new MockTransport());

    await server.connect(transport as any);

    transport.onmessage?.(buildToolsCall());

    await vi.waitFor(() => {
      expect(transport.send).toHaveBeenCalled();
    });

    const response = transport.sent.at(-1);
    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: expect.stringMatching(compatIdPattern),
    });
    expect(response?.result).toBeDefined();
  });

  it('wraps handlers assigned after compatibility wrapping', async () => {
    const { wrapTransportForCompatibility } = await import('../src/utils/jsonRpcCompat.js');
    const transport = wrapTransportForCompatibility(new MockTransport());

    const handler = vi.fn();
    transport.onmessage = handler;

    const payload = { jsonrpc: '2.0', method: 'tools/call', params: { name: 'noop' } };
    transport.onmessage?.(payload);

    expect(handler).toHaveBeenCalledTimes(1);
    const [{ id }] = handler.mock.calls[0];
    expect(id).toMatch(compatIdPattern);
  });

  it('generates unique ids for identical stdio requests', async () => {
    await stubState();

    const { createMcpServer } = await import('../src/index.js');
    const { wrapTransportForCompatibility } = await import('../src/utils/jsonRpcCompat.js');

    const server = await createMcpServer();
    const transport = wrapTransportForCompatibility(new MockTransport());

    await server.connect(transport as any);

    transport.onmessage?.(buildToolsCall());
    transport.onmessage?.(buildToolsCall());

    await vi.waitFor(() => {
      expect(transport.send).toHaveBeenCalledTimes(2);
    });

    const [first, second] = transport.sent.slice(-2);
    expect(first.id).toMatch(compatIdPattern);
    expect(second.id).toMatch(compatIdPattern);
    expect(first.id).not.toBe(second.id);
    expect(first.result).toBeDefined();
    expect(second.result).toBeDefined();
  });

  it('returns InvalidParams errors when required fields are missing', async () => {
    await stubState();

    const { createMcpServer } = await import('../src/index.js');
    const { wrapTransportForCompatibility } = await import('../src/utils/jsonRpcCompat.js');

    const server = await createMcpServer();
    const transport = wrapTransportForCompatibility(new MockTransport());

    await server.connect(transport as any);

    const invalidPayload = buildToolsCall({ plan: undefined });
    delete (invalidPayload.params as any).arguments.plan;

    transport.onmessage?.(invalidPayload);

    await vi.waitFor(() => {
      expect(transport.send).toHaveBeenCalled();
    });

    const response = transport.sent.at(-1);
    expect(response).toMatchObject({
      jsonrpc: '2.0',
      error: { code: -32602 },
      id: expect.stringMatching(compatIdPattern),
    });
    expect(response?.error?.message).toContain('Missing: plan');
  });

  it('returns InvalidParams errors in discovery mode', async () => {
    process.env.MCP_DISCOVERY_MODE = '1';
    await stubState();

    const { createMcpServer } = await import('../src/index.js');
    const { wrapTransportForCompatibility } = await import('../src/utils/jsonRpcCompat.js');

    const server = await createMcpServer();
    const transport = wrapTransportForCompatibility(new MockTransport());

    await server.connect(transport as any);

    const invalidPayload = buildToolsCall({ plan: undefined });
    delete (invalidPayload.params as any).arguments.plan;

    transport.onmessage?.(invalidPayload);

    await vi.waitFor(() => {
      expect(transport.send).toHaveBeenCalled();
    });

    const response = transport.sent.at(-1);
    expect(response).toMatchObject({
      jsonrpc: '2.0',
      error: { code: -32602 },
      id: expect.stringMatching(compatIdPattern),
    });
    expect(response?.error?.message).toContain('discovery: missing [plan]');
  });

  it('handles large payloads without truncation', async () => {
    await stubState();

    const { createMcpServer } = await import('../src/index.js');
    const { wrapTransportForCompatibility } = await import('../src/utils/jsonRpcCompat.js');

    const server = await createMcpServer();
    const transport = wrapTransportForCompatibility(new MockTransport());

    await server.connect(transport as any);

    const largePlan = 'A'.repeat(256 * 1024);
    transport.onmessage?.(
      buildToolsCall({ plan: largePlan })
    );

    await vi.waitFor(() => {
      expect(transport.send).toHaveBeenCalled();
    });

    const response = transport.sent.at(-1);
    expect(response?.result).toBeDefined();
    expect(response?.id).toMatch(compatIdPattern);
  });

  it('emits HTTP JSON responses with synthesized ids when Accept is application/json', async () => {
    await stubState();

    const { startHttpServer } = await import('../src/index.js');

    const silentLogger = { log: vi.fn(), error: vi.fn() };
    const serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });

    try {
      const address = serverInstance.listener.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(buildToolsCall()),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      const payload = await res.json();
      expect(payload).toMatchObject({
        jsonrpc: '2.0',
        id: expect.stringMatching(compatIdPattern),
      });
      expect(payload?.result).toBeDefined();
    } finally {
      await serverInstance.close();
    }
  });

  it('emits SSE responses with synthesized ids when Accept is text/event-stream', async () => {
    await stubState();

    const { startHttpServer } = await import('../src/index.js');

    const silentLogger = { log: vi.fn(), error: vi.fn() };
    const serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });

    try {
      const address = serverInstance.listener.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(buildToolsCall()),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      const events = await readSSEBody(res);
      const message = events.at(-1);
      expect(message).toMatchObject({
        jsonrpc: '2.0',
        id: expect.stringMatching(compatIdPattern),
      });
      expect(message?.result).toBeDefined();
    } finally {
      await serverInstance.close();
    }
  });

  it('keeps JSON fallback request-scoped under concurrent traffic', async () => {
    await stubState();

    const { startHttpServer } = await import('../src/index.js');

    const silentLogger = { log: vi.fn(), error: vi.fn() };
    const serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });

    try {
      const address = serverInstance.listener.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      for (let i = 0; i < 2; i++) {
        const jsonPromise = fetch(`http://127.0.0.1:${port}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(buildToolsCall({ goal: `Ship safely ${i}` })),
        }).then(async (res) => {
          expect(res.status).toBe(200);
          expect(res.headers.get('content-type')).toContain('application/json');
          const payload = await res.json();
          expect(payload).toMatchObject({
            jsonrpc: '2.0',
            id: expect.stringMatching(compatIdPattern),
          });
          return payload;
        });

        const ssePromise = fetch(`http://127.0.0.1:${port}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(buildToolsCall({ goal: `Stream safely ${i}` })),
        }).then(async (res) => {
          expect(res.status).toBe(200);
          expect(res.headers.get('content-type')).toContain('text/event-stream');
          const events = await readSSEBody(res);
          const message = events.at(-1);
          expect(message).toMatchObject({
            jsonrpc: '2.0',
            id: expect.stringMatching(compatIdPattern),
          });
          return events;
        });

        const [jsonPayload, sseEvents] = await Promise.all([jsonPromise, ssePromise]);
        expect(jsonPayload?.result).toBeDefined();
        expect(sseEvents.at(-1)?.result).toBeDefined();
      }
    } finally {
      await serverInstance.close();
    }
  });

  it('prefers streaming when both application/json and text/event-stream are accepted', async () => {
    await stubState();

    const { startHttpServer } = await import('../src/index.js');

    const silentLogger = { log: vi.fn(), error: vi.fn() };
    const serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });

    try {
      const address = serverInstance.listener.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify(buildToolsCall()),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      const events = await readSSEBody(res);
      const message = events.at(-1);
      expect(message).toMatchObject({
        jsonrpc: '2.0',
        id: expect.stringMatching(compatIdPattern),
      });
    } finally {
      await serverInstance.close();
    }
  });

  it('defaults to streaming when no Accept header is provided', async () => {
    await stubState();

    const { startHttpServer } = await import('../src/index.js');

    const silentLogger = { log: vi.fn(), error: vi.fn() };
    const serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });

    try {
      const address = serverInstance.listener.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildToolsCall()),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/event-stream');
      const events = await readSSEBody(res);
      expect(events.at(-1)).toMatchObject({
        jsonrpc: '2.0',
        id: expect.stringMatching(compatIdPattern),
      });
    } finally {
      await serverInstance.close();
    }
  });

  it('does not leave json fallback enabled on the transport after JSON responses', async () => {
    await stubState();

    const { startHttpServer } = await import('../src/index.js');

    const silentLogger = { log: vi.fn(), error: vi.fn() };
    const serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });

    try {
      const address = serverInstance.listener.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(buildToolsCall()),
      });

      expect(res.status).toBe(200);
      await res.json();

      expect((serverInstance.transport as any)._enableJsonResponse).toBe(false);
    } finally {
      await serverInstance.close();
    }
  });

  it('routes logs to stderr when MCP_TRANSPORT=stdio', async () => {
    process.env.MCP_TRANSPORT = 'stdio';
    const originalLog = console.log;
    const originalError = console.error;

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    let errorSpy: ReturnType<typeof vi.spyOn> | null = null;

    try {
      await import('../src/index.js');
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      console.log('shim-log');
      expect(errorSpy).toHaveBeenCalledWith('shim-log');
      expect(stdoutSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy?.mockRestore();
      console.log = originalLog;
      console.error = originalError;
    }
  });
});
