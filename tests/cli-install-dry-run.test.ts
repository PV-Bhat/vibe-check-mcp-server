import { promises as fs } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { format } from 'node:util';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createCliProgram } from '../src/cli/index.js';

const FIXTURE = join(process.cwd(), 'tests', 'fixtures', 'claude', 'config.base.json');

describe('cli install --dry-run', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.exitCode = undefined;
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('prints a unified diff without writing changes', async () => {
    const tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'vibe-dryrun-'));
    const configPath = join(tmpDir, 'claude.json');
    const original = readFileSync(FIXTURE, 'utf8');
    await fs.writeFile(configPath, original, 'utf8');

    process.env.VIBE_CHECK_API_KEY = 'dry-run-key';

    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((message?: unknown, ...rest: unknown[]) => {
      logs.push(format(String(message ?? ''), ...rest));
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const program = createCliProgram();
    await program.parseAsync([
      'node',
      'vibe-check-mcp',
      'install',
      '--client',
      'claude',
      '--config',
      configPath,
      '--dry-run',
      '--non-interactive',
    ]);

    logSpy.mockRestore();
    warnSpy.mockRestore();

    const joined = logs.join('\n');
    expect(joined).toContain('@@');
    expect(joined).toContain('vibe-check-mcp-cli"');
    expect(joined).toContain('@pv-bhat/vibe-check-mcp');

    const after = await fs.readFile(configPath, 'utf8');
    expect(after).toBe(original);

    const files = await fs.readdir(tmpDir);
    expect(files.some((file) => file.endsWith('.bak'))).toBe(false);
  });
});
