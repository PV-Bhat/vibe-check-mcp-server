import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { format } from 'node:util';
import net from 'node:net';
import { createCliProgram } from '../src/cli/index.js';

describe('cli doctor port diagnostics', () => {
  beforeEach(() => {
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports occupied ports as in-use', async () => {
    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen({ port: 0, host: '127.0.0.1' }, () => resolve());
    });

    const address = server.address();
    if (typeof address !== 'object' || address === null) {
      throw new Error('Failed to acquire port for test');
    }

    const port = address.port;
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((message?: unknown, ...rest: unknown[]) => {
      logs.push(format(String(message ?? ''), ...rest));
    });

    const program = createCliProgram();
    await program.parseAsync(['node', 'vibe-check-mcp', 'doctor', '--http', '--port', String(port)]);

    logSpy.mockRestore();
    await new Promise<void>((resolve) => server.close(() => resolve()));

    const output = logs.join('\n');
    expect(output).toContain(`HTTP port ${port}: in-use`);
    expect(process.exitCode).toBeUndefined();
  });
});
