import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import type { HttpServerInstance, LoggerLike } from '../src/index.js';

/**
 * Exercises the CallTool request handler's argument validation and the
 * constitution tools end to end. These are the paths an agent hits when it
 * calls a tool with a bad payload, so their error shape is part of the
 * contract — an MCP error rather than a crash or a silent success.
 */

let tempHome: string;
let originalHome: string | undefined;
const originalGeminiKey = process.env.GEMINI_API_KEY;

let startHttpServer: typeof import('../src/index.js')['startHttpServer'];

const silentLogger: LoggerLike = { log: vi.fn(), error: vi.fn() };

beforeAll(async () => {
  originalHome = process.env.HOME;
  tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-tool-validation-'));
  process.env.HOME = tempHome;
  delete process.env.GEMINI_API_KEY;

  ({ startHttpServer } = await import('../src/index.js'));
});

afterAll(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tempHome, { recursive: true, force: true });
  if (originalGeminiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiKey;
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

let nextId = 1;

/**
 * Issue one tools/call against a freshly started server.
 *
 * A server is started per call because a shared stateless
 * StreamableHTTPServerTransport only serves a single request on MCP SDK >=1.26
 * — see the note in tests/server.integration.test.ts. Constitution state is
 * module-level, so it still persists across these servers within a file.
 */
async function callTool(name: string, args: unknown): Promise<any> {
  const instance: HttpServerInstance = await startHttpServer({
    port: 0,
    attachSignalHandlers: false,
    logger: silentLogger,
  });
  const address = instance.listener.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: nextId++,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    });

    const text = await res.text();
    const events = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data: '))
      .map((line) => JSON.parse(line.slice(6)));
    return events.at(-1);
  } finally {
    await instance.close();
  }
}

describe('tool argument validation', () => {
  it('rejects vibe_check without goal and names both missing fields', async () => {
    const response = await callTool('vibe_check', {});
    expect(response.error.message).toContain('goal');
    expect(response.error.message).toContain('plan');
    // The message carries a copy-pasteable example so the agent can self-correct.
    expect(response.error.message).toContain('"goal"');
  });

  it('rejects vibe_check when plan is the wrong type', async () => {
    const response = await callTool('vibe_check', { goal: 'g', plan: 42 });
    expect(response.error.message).toContain('plan');
    expect(response.error.message).not.toContain('goal:');
  });

  it('rejects vibe_learn without mistake or category', async () => {
    const response = await callTool('vibe_learn', {});
    expect(response.error.message).toContain('mistake');
    expect(response.error.message).toContain('category');
  });

  it('rejects update_constitution without sessionId or rule', async () => {
    const response = await callTool('update_constitution', {});
    expect(response.error.message).toContain('sessionId');
    expect(response.error.message).toContain('rule');
  });

  it('rejects reset_constitution when rules is not an array', async () => {
    const response = await callTool('reset_constitution', { sessionId: 's1', rules: 'nope' });
    expect(response.error.message).toContain('rules');
  });

  it('rejects check_constitution without sessionId', async () => {
    const response = await callTool('check_constitution', {});
    expect(response.error.message).toContain('sessionId');
  });

  it('rejects an unknown tool name', async () => {
    const response = await callTool('not_a_tool', {});
    expect(response.error.message).toContain('not_a_tool');
  });
});

describe('constitution tools', () => {
  it('accumulates rules, then returns them for the session', async () => {
    const sessionId = 'constitution-session-a';

    const first = await callTool('update_constitution', { sessionId, rule: 'Write tests first' });
    expect(first.result.content[0].text).toContain('Constitution updated');

    await callTool('update_constitution', { sessionId, rule: 'No network calls' });

    const check = await callTool('check_constitution', { sessionId });
    expect(JSON.parse(check.result.content[0].text)).toEqual({
      rules: ['Write tests first', 'No network calls'],
    });
  });

  it('replaces the whole rule set on reset', async () => {
    const sessionId = 'constitution-session-b';
    await callTool('update_constitution', { sessionId, rule: 'Original rule' });

    const reset = await callTool('reset_constitution', { sessionId, rules: ['Only rule'] });
    expect(reset.result.content[0].text).toContain('Constitution reset');

    const check = await callTool('check_constitution', { sessionId });
    expect(JSON.parse(check.result.content[0].text)).toEqual({ rules: ['Only rule'] });
  });

  it('keeps sessions isolated from one another', async () => {
    await callTool('update_constitution', { sessionId: 'session-x', rule: 'X only' });

    const other = await callTool('check_constitution', { sessionId: 'session-y' });
    expect(JSON.parse(other.result.content[0].text)).toEqual({ rules: [] });
  });

  it('returns MCP text content, not a bare object (regression: #84)', async () => {
    const check = await callTool('check_constitution', { sessionId: 'session-z' });
    expect(check.result.content[0].type).toBe('text');
    expect(typeof check.result.content[0].text).toBe('string');
  });
});
