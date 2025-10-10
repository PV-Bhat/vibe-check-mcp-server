import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { format } from 'node:util';
import { createCliProgram } from '../src/cli/index.js';

function collectLogs() {
  const logs: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((message?: unknown, ...rest: unknown[]) => {
    logs.push(format(String(message ?? ''), ...rest));
  });

  return { logs, restore: () => logSpy.mockRestore() };
}

describe('cli start command flags', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.exitCode = undefined;
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  async function runStartCommand(...args: string[]): Promise<string> {
    const { logs, restore } = collectLogs();
    const program = createCliProgram();

    await program.parseAsync(['node', 'vibe-check-mcp', 'start', ...args, '--dry-run']);

    restore();
    return logs.join('\n');
  }

  it('defaults to stdio when no flag or env is provided', async () => {
    delete process.env.MCP_TRANSPORT;

    const output = await runStartCommand();
    expect(output).toContain('MCP_TRANSPORT=stdio');
    expect(output).not.toContain('MCP_HTTP_PORT');
  });

  it('preserves MCP_TRANSPORT from the environment when no flag is set', async () => {
    process.env.MCP_TRANSPORT = 'http';

    const output = await runStartCommand();
    expect(output).toContain('MCP_TRANSPORT=http');
    expect(output).toContain('MCP_HTTP_PORT=2091');
  });

  it('allows CLI flags to override MCP_TRANSPORT from the environment', async () => {
    process.env.MCP_TRANSPORT = 'http';

    const output = await runStartCommand('--stdio');
    expect(output).toContain('MCP_TRANSPORT=stdio');
    expect(output).not.toContain('MCP_HTTP_PORT');
  });

  it('prints http transport and chosen port during dry run', async () => {
    const output = await runStartCommand('--http', '--port', '1234');
    expect(output).toContain('MCP_TRANSPORT=http');
    expect(output).toContain('MCP_HTTP_PORT=1234');
  });
});
