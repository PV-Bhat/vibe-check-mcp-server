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
  beforeEach(() => {
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints stdio transport during dry run', async () => {
    const { logs, restore } = collectLogs();
    const program = createCliProgram();

    await program.parseAsync(['node', 'vibe-check-mcp', 'start', '--stdio', '--dry-run']);

    restore();
    expect(logs.join('\n')).toContain('MCP_TRANSPORT=stdio');
    expect(logs.join('\n')).not.toContain('MCP_HTTP_PORT');
  });

  it('prints http transport and port during dry run', async () => {
    const { logs, restore } = collectLogs();
    const program = createCliProgram();

    await program.parseAsync(['node', 'vibe-check-mcp', 'start', '--http', '--port', '1234', '--dry-run']);

    restore();
    const output = logs.join('\n');
    expect(output).toContain('MCP_TRANSPORT=http');
    expect(output).toContain('MCP_HTTP_PORT=1234');
  });
});
