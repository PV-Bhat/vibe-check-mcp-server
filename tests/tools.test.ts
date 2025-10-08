import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import net from 'net';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runCheckConstitutionTest() {
  const startTime = Date.now();

  const projectRoot = path.resolve(__dirname, '..');
  const indexPath = path.join(projectRoot, 'build', 'index.js');

  const getPort = () =>
    new Promise<number>((resolve, reject) => {
      const s = net.createServer();
      s.listen(0, () => {
        const p = (s.address() as any).port;
        s.close(() => resolve(p));
      });
      s.on('error', reject);
    });

  const port = await getPort();
  const env: NodeJS.ProcessEnv = { ...process.env, MCP_HTTP_PORT: String(port) };

  const serverProcess = spawn('node', [indexPath], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    let res: Response | null = null;
    const requestId = 1;
    const sessionId = randomUUID();

    // Wait for server to be ready
    for (let i = 0; i < 40; i++) {
      try {
        const attempt = await fetch(`http://localhost:${port}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: requestId,
            method: 'tools/list',
            params: {}
          }),
        });
        if (attempt.status === 200) {
          res = attempt;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!res) throw new Error('Server did not start');

    // Now make the actual check_constitution call
    const response = await fetch(`http://localhost:${port}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: requestId + 1,
        method: 'tools/call',
        params: {
          name: 'check_constitution',
          arguments: {
            sessionId,
          },
        },
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const text = await response.text();
    const lines = text.split('\n');
    const dataLine = lines.find((l) => l.startsWith('data: '));

    if (!dataLine) {
      throw new Error('No data line found in response');
    }

    const json = JSON.parse(dataLine.slice(6));

    // Validate the response structure
    expect(json).toHaveProperty('result');
    expect(json.result).toHaveProperty('content');
    expect(Array.isArray(json.result.content)).toBe(true);
    expect(json.result.content.length).toBe(1);

    // Validate the content type is 'text' (not 'json')
    const firstContent = json.result.content[0];
    expect(firstContent.type).toBe('text');
    expect(typeof firstContent.text).toBe('string');

    // Validate the nested JSON within the 'text' field
    const parsedText = JSON.parse(firstContent.text);
    expect(parsedText).toHaveProperty('rules');
    expect(Array.isArray(parsedText.rules)).toBe(true);

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000);
  } finally {
    serverProcess.kill();
  }
}

describe('Tool Call Integration Tests', () => {
  it('check_constitution returns text content with rules array', async () => {
    await runCheckConstitutionTest();
  }, 10000);
});