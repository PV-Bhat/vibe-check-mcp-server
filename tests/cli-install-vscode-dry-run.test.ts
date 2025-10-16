import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { createCliProgram } from '../src/cli/index.js';

const ORIGINAL_ENV = { ...process.env };

describe('cli install vscode manual guidance', () => {
  beforeEach(() => {
    process.exitCode = undefined;
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('prints manual instructions and install link when config is missing', async () => {
    process.env.OPENAI_API_KEY = 'sk-manual-test';

    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((message?: unknown) => {
      logs.push(String(message ?? ''));
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const program = createCliProgram();
    await program.parseAsync([
      'node',
      'vibe-check-mcp',
      'install',
      '--client',
      'vscode',
      '--http',
      '--port',
      '3001',
      '--dry-run',
      '--non-interactive',
    ]);

    logSpy.mockRestore();
    warnSpy.mockRestore();

    const output = logs.join('\n');
    expect(output).toContain('configuration not found');
    expect(output).toContain('Add this MCP server configuration manually');
    expect(output).toContain('VS Code quick install link');
    expect(output).toContain('vscode:mcp/install');
    expect(output).toContain('http://127.0.0.1:3001');
    expect(output).toContain('--http');
  });
});
