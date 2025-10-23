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

async function readSSEBody(res: Response) {
  const text = await res.text();
  const dataLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data: '));
  return dataLines.map((line) => JSON.parse(line.slice(6)));
}

describe('JSON-RPC compatibility shim', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.MCP_TRANSPORT;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('synthesizes ids for stdio tools/call requests', async () => {
    const stateModule = await import('../src/utils/state.js');
    vi.spyOn(stateModule, 'loadHistory').mockResolvedValue();
    vi.spyOn(stateModule, 'addToHistory').mockImplementation(() => {});

    const { createMcpServer } = await import('../src/index.js');
    const { wrapTransportForCompatibility } = await import('../src/utils/jsonRpcCompat.js');

    const server = await createMcpServer();
    const transport = wrapTransportForCompatibility(new MockTransport());

    await server.connect(transport as any);

    transport.onmessage?.({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'vibe_check',
        arguments: { goal: 'Ship safely', plan: '1) tests 2) deploy' },
      },
    });

    await vi.waitFor(() => {
      expect(transport.send).toHaveBeenCalled();
    });

    const response = transport.sent.at(-1);
    expect(response).toMatchObject({
      jsonrpc: '2.0',
      id: expect.stringContaining('compat-'),
    });
    expect(response?.result).toBeDefined();
  });

  it('emits HTTP responses when the request id is missing', async () => {
    const stateModule = await import('../src/utils/state.js');
    vi.spyOn(stateModule, 'loadHistory').mockResolvedValue();
    vi.spyOn(stateModule, 'addToHistory').mockImplementation(() => {});

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
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'vibe_check',
            arguments: { goal: 'Ship safely', plan: '1) tests 2) deploy' },
          },
        }),
      });

      expect(res.status).toBe(200);
      const events = await readSSEBody(res);
      const message = events.at(-1);
      expect(message).toMatchObject({
        jsonrpc: '2.0',
        id: expect.stringContaining('compat-'),
      });
      expect(message?.result).toBeDefined();
    } finally {
      await serverInstance.close();
    }
  });
});
