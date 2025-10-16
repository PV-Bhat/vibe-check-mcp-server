import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import type { HttpServerInstance, HttpServerOptions, LoggerLike } from '../src/index.js';

let tempHome: string;
let originalHome: string | undefined;

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

  ({ startHttpServer } = await import('../src/index.js'));
  llmModule = await import('../src/utils/llm.js');
  vibeLearnModule = await import('../src/tools/vibeLearn.js');
});

afterAll(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tempHome, { recursive: true, force: true });
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
