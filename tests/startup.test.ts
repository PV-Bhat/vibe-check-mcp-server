import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runStartupTest(envVar: 'MCP_HTTP_PORT' | 'PORT') {
  const startTime = Date.now();

  const projectRoot = path.resolve(__dirname, '..');
  const indexPath = path.join(projectRoot, 'build', 'index.js');

  const port = await new Promise<number>((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, () => {
      const p = (s.address() as any).port;
      s.close(() => resolve(p));
    });
    s.on('error', reject);
  });

  const serverProcess = spawn('node', [indexPath], {
    env: { ...process.env, [envVar]: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    let res: Response | null = null;
    for (let i = 0; i < 40; i++) {
      try {
        const attempt = await fetch(`http://localhost:${port}/mcp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream'
          },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
        });
        if (attempt.status === 200) {
          res = attempt;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!res) throw new Error('Server did not start');
    const text = await res.text();
    const line = text.split('\n').find((l) => l.startsWith('data: '));
    const json = line ? JSON.parse(line.slice(6)) : null;

    const duration = Date.now() - startTime;
    expect(res.status).toBe(200);
    expect(json?.result?.tools.some((t: any) => t.name === 'update_constitution')).toBe(true);
    expect(duration).toBeLessThan(5000);
  } finally {
    serverProcess.kill();
  }
}

describe('Server Startup and Response Time', () => {
  it('should start and respond to a tools/list request over HTTP using MCP_HTTP_PORT', async () => {
    await runStartupTest('MCP_HTTP_PORT');
  }, 10000);

  it('should start and respond to a tools/list request over HTTP using PORT', async () => {
    await runStartupTest('PORT');
  }, 10000);
});
