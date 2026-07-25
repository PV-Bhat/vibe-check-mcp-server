import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import http from 'node:http';
import os from 'os';
import path from 'path';

import type { HttpServerInstance, HttpServerOptions, LoggerLike } from '../src/index.js';

let tempHome: string;
let originalHome: string | undefined;
const originalGeminiKey = process.env.GEMINI_API_KEY;

function clearGeminiKey() {
  delete process.env.GEMINI_API_KEY;
}

function restoreGeminiKey() {
  if (originalGeminiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiKey;
  }
}

let startHttpServer: (options?: HttpServerOptions) => Promise<HttpServerInstance>;
let llmModule: typeof import('../src/utils/llm.js');
let vibeLearnModule: typeof import('../src/tools/vibeLearn.js');

const silentLogger: LoggerLike = {
  log: vi.fn(),
  error: vi.fn(),
};

beforeAll(async () => {
  originalHome = process.env.HOME;
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-server-test-'));
  process.env.HOME = tempHome;
  clearGeminiKey();

  ({ startHttpServer } = await import('../src/index.js'));
  llmModule = await import('../src/utils/llm.js');
  vibeLearnModule = await import('../src/tools/vibeLearn.js');
});

afterAll(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tempHome, { recursive: true, force: true });
  restoreGeminiKey();
});

let serverInstance: HttpServerInstance | undefined;

afterEach(async () => {
  vi.restoreAllMocks();
  if (serverInstance) {
    await serverInstance.close();
  }
  serverInstance = undefined;
});

function getPort(instance: HttpServerInstance): number {
  const address = instance.listener.address();
  return typeof address === 'object' && address ? address.port : 0;
}

/**
 * POST to the server with an arbitrary Host header.
 * `fetch` treats Host as a forbidden header and silently drops it, so the
 * DNS-rebinding checks have to be exercised through the raw http client.
 */
function postWithHost(port: number, host: string, payload: unknown): Promise<{ status: number; body: string }> {
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/mcp',
        method: 'POST',
        headers: {
          Host: host,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

/** Preflight with an arbitrary Host header (see postWithHost for why raw http). */
function optionsWithHost(
  port: number,
  host: string,
  origin: string
): Promise<{ status: number; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/mcp',
        method: 'OPTIONS',
        headers: {
          Host: host,
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
      }
    );
    req.on('error', reject);
    req.end();
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

describe('HTTP server integration', () => {
  it('responds to tools/list requests over HTTP', async () => {
    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });

    expect(res.status).toBe(200);
    const events = await readSSEBody(res);
    const result = events.at(-1)?.result;
    expect(result?.tools.some((tool: any) => tool.name === 'vibe_check')).toBe(true);
  });

  it('serves health checks', async () => {
    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('returns method not allowed for GET /mcp', async () => {
    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    const res = await fetch(`http://127.0.0.1:${port}/mcp`);
    expect(res.status).toBe(405);
    expect(await res.json()).toMatchObject({ error: { message: 'Method not allowed' } });
  });

  it('returns an internal error when the transport handler fails', async () => {
    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    const handleSpy = vi
      .spyOn(serverInstance.transport, 'handleRequest')
      .mockRejectedValue(new Error('transport failed'));

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });

    expect(handleSpy).toHaveBeenCalledOnce();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      jsonrpc: '2.0',
      id: 2,
      error: { code: -32603, message: 'Internal server error' },
    });
  });

  it('falls back to default questions when the LLM request fails', async () => {
    vi.spyOn(llmModule, 'getMetacognitiveQuestions').mockRejectedValue(new Error('LLM offline'));

    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'vibe_check',
          arguments: { goal: 'Ship safely', plan: '1) tests 2) deploy' },
        },
      }),
    });

    expect(res.status).toBe(200);
    const events = await readSSEBody(res);
    const content = events.at(-1)?.result?.content?.[0]?.text;
    expect(content).toContain('Does this plan directly address what the user requested');
  });

  it('formats vibe_learn responses with category summaries', async () => {
    const vibeSpy = vi.spyOn(vibeLearnModule, 'vibeLearnTool').mockResolvedValue({
      added: true,
      alreadyKnown: false,
      currentTally: 2,
      topCategories: [
        {
          category: 'Feature Creep',
          count: 3,
          recentExample: {
            type: 'mistake',
            category: 'Feature Creep',
            mistake: 'Overbuilt solution',
            solution: 'Simplify approach',
            timestamp: Date.now(),
          },
        },
      ],
    });

    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'vibe_learn',
          arguments: { mistake: 'Test mistake', category: 'Feature Creep', solution: 'Fix it', type: 'mistake' },
        },
      }),
    });

    expect(vibeSpy).toHaveBeenCalled();
    expect(res.status).toBe(200);
    const events = await readSSEBody(res);
    const text = events.at(-1)?.result?.content?.[0]?.text ?? '';
    expect(text).toContain('✅ Pattern logged successfully');
    expect(text).toContain('Top Pattern Categories');
    expect(text).toContain('Feature Creep (3 occurrences)');
    expect(text).toContain('Most recent: "Overbuilt solution"');
    expect(text).toContain('Solution: "Simplify approach"');
  });

  it('indicates when a learning entry is already known', async () => {
    vi.spyOn(vibeLearnModule, 'vibeLearnTool').mockResolvedValue({
      added: false,
      alreadyKnown: true,
      currentTally: 5,
      topCategories: [],
    });

    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'vibe_learn',
          arguments: { mistake: 'Repeated mistake', category: 'Feature Creep', solution: 'Fix it', type: 'mistake' },
        },
      }),
    });

    expect(res.status).toBe(200);
    const events = await readSSEBody(res);
    const text = events.at(-1)?.result?.content?.[0]?.text ?? '';
    expect(text).toContain('Pattern already recorded');
  });

  it('reports when a learning entry cannot be logged', async () => {
    vi.spyOn(vibeLearnModule, 'vibeLearnTool').mockResolvedValue({
      added: false,
      alreadyKnown: false,
      currentTally: 0,
      topCategories: [],
    });

    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'vibe_learn',
          arguments: { mistake: 'Unknown failure', category: 'Other', solution: 'n/a', type: 'mistake' },
        },
      }),
    });

    expect(res.status).toBe(200);
    const events = await readSSEBody(res);
    const text = events.at(-1)?.result?.content?.[0]?.text ?? '';
    expect(text).toContain('Failed to log pattern');
  });

  it('rejects requests whose Host header is not allowlisted', async () => {
    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    // Simulates DNS rebinding: the connection lands on loopback, but the browser
    // believes it is talking to attacker.example and so applies no CORS policy.
    const res = await postWithHost(port, 'attacker.example', { jsonrpc: '2.0', id: 7, method: 'tools/list', params: {} });

    expect(res.status).toBe(403);
    expect(JSON.parse(res.body)).toMatchObject({ error: { code: -32000 } });
  });

  it('accepts a non-loopback Host when explicitly allowlisted', async () => {
    serverInstance = await startHttpServer({
      port: 0,
      attachSignalHandlers: false,
      allowedHosts: 'mcp.internal',
      logger: silentLogger,
    });
    const port = getPort(serverInstance);

    const res = await postWithHost(port, 'mcp.internal', { jsonrpc: '2.0', id: 8, method: 'tools/list', params: {} });

    expect(res.status).toBe(200);
  });

  it('rejects oversized request bodies with a JSON-RPC error', async () => {
    serverInstance = await startHttpServer({
      port: 0,
      attachSignalHandlers: false,
      maxBodySize: '1kb',
      logger: silentLogger,
    });
    const port = getPort(serverInstance);

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: { name: 'vibe_check', arguments: { goal: 'x'.repeat(4096), plan: 'p' } },
      }),
    });

    expect(res.status).toBe(413);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toMatchObject({ jsonrpc: '2.0', error: { code: -32600 } });
  });

  it('does not grant CORS to a non-loopback origin by default', async () => {
    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('grants CORS to a loopback origin by default', async () => {
    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });

    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(res.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('honours CORS_ORIGIN from the environment', async () => {
    process.env.CORS_ORIGIN = 'https://trusted.example';
    try {
      serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
      const port = getPort(serverInstance);

      const allowed = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://trusted.example', 'Access-Control-Request-Method': 'POST' },
      });
      expect(allowed.headers.get('access-control-allow-origin')).toBe('https://trusted.example');

      // An explicit allowlist replaces the loopback default rather than extending it.
      const rejected = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' },
      });
      expect(rejected.headers.get('access-control-allow-origin')).toBeNull();
    } finally {
      delete process.env.CORS_ORIGIN;
    }
  });

  it('does not answer a CORS preflight for a disallowed Host', async () => {
    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    // The Host check must run before cors(), which otherwise terminates an
    // allowed-origin preflight itself and never reaches the Host middleware.
    const res = await optionsWithHost(port, 'attacker.example', 'http://localhost:5173');

    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('honours MCP_ALLOWED_HOSTS from the environment, including a port', async () => {
    process.env.MCP_ALLOWED_HOSTS = 'mcp.internal:8080';
    try {
      serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
      const port = getPort(serverInstance);

      const res = await postWithHost(port, 'mcp.internal:8080', {
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/list',
        params: {},
      });
      expect(res.status).toBe(200);
    } finally {
      delete process.env.MCP_ALLOWED_HOSTS;
    }
  });

  it('honours MCP_MAX_BODY_SIZE from the environment', async () => {
    process.env.MCP_MAX_BODY_SIZE = '1kb';
    try {
      serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
      const port = getPort(serverInstance);

      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 11, method: 'tools/list', params: { pad: 'x'.repeat(4096) } }),
      });

      expect(res.status).toBe(413);
    } finally {
      delete process.env.MCP_MAX_BODY_SIZE;
    }
  });

  it('returns a JSON-RPC parse error for malformed JSON', async () => {
    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{"jsonrpc": "2.0", ',
    });

    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toMatchObject({ error: { code: -32700 } });
  });

  it('returns JSON rather than HTML for unknown routes', async () => {
    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    const res = await fetch(`http://127.0.0.1:${port}/nope`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toMatchObject({ jsonrpc: '2.0', error: { code: -32601 } });
  });

  it('does not advertise the Express runtime', async () => {
    serverInstance = await startHttpServer({ port: 0, attachSignalHandlers: false, logger: silentLogger });
    const port = getPort(serverInstance);

    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('attaches and removes signal handlers when enabled', async () => {
    const initialSigint = process.listeners('SIGINT').length;
    const initialSigterm = process.listeners('SIGTERM').length;

    const instance = await startHttpServer({ port: 0, attachSignalHandlers: true, logger: silentLogger });

    const duringSigint = process.listeners('SIGINT').length;
    const duringSigterm = process.listeners('SIGTERM').length;
    expect(duringSigint).toBeGreaterThanOrEqual(initialSigint + 1);
    expect(duringSigterm).toBeGreaterThanOrEqual(initialSigterm + 1);

    await instance.close();
    expect(process.listeners('SIGINT').length).toBe(initialSigint);
    expect(process.listeners('SIGTERM').length).toBe(initialSigterm);
  });
});
