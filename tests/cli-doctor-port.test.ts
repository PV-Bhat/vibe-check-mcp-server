import { describe, it, expect } from 'vitest';
import { createServer } from 'node:net';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const cliPath = resolve(projectRoot, 'build', 'cli', 'index.js');

describe('doctor port status', () => {
  it('reports when the HTTP port is in use', async function () {
    if (process.env.CI) {
      this.skip();
    }

    const server = createServer();
    const port = await new Promise<number>((resolvePort, reject) => {
      server.once('error', reject);
      server.listen(0, () => {
        const address = server.address();
        const resolvedPort = typeof address === 'object' && address ? address.port : 0;
        resolvePort(resolvedPort);
      });
    });

    try {
      const result = spawnSync('node', [cliPath, 'doctor', '--http', '--port', String(port)], {
        encoding: 'utf8',
      });

      const combinedOutput = `${result.stdout}${result.stderr}`;
      expect(combinedOutput).toContain(`HTTP port ${port}: already in use`);
    } finally {
      server.close();
    }
  });
});

