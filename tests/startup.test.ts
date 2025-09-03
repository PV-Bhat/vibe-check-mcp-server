import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Server Startup and Response Time', () => {
  it.skip('should start and respond to a tools/list request over HTTP', async () => {
    const startTime = Date.now();

    const projectRoot = path.resolve(__dirname, '..');
    const indexPath = path.join(projectRoot, 'build', 'index.js');

    const serverProcess = spawn('node', [indexPath], {
      env: { ...process.env, MCP_HTTP_PORT: '3101' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    try {
      let res: Response | null = null;
      for (let i = 0; i < 40; i++) {
        try {
          const attempt = await fetch('http://localhost:3101/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
      const json = await res.json();

      const duration = Date.now() - startTime;
      expect(res.status).toBe(200);
      expect(json.result.tools.some((t: any) => t.name === 'update_constitution')).toBe(true);
      expect(duration).toBeLessThan(5000);
    } finally {
      serverProcess.kill();
    }
  }, 10000);
});
