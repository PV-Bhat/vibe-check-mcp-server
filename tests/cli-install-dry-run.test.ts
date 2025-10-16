import { promises as fs } from 'node:fs';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import os from 'node:os';
import { format } from 'node:util';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createCliProgram } from '../src/cli/index.js';

type ClientFixture = {
  client: 'claude' | 'cursor' | 'windsurf' | 'vscode';
  fixture: string;
  fileName: string;
};

const FIXTURES: ClientFixture[] = [
  {
    client: 'claude',
    fixture: join('claude', 'config.base.json'),
    fileName: 'claude.json',
  },
  {
    client: 'cursor',
    fixture: join('cursor', 'config.base.json'),
    fileName: 'cursor.json',
  },
  {
    client: 'windsurf',
    fixture: join('windsurf', 'config.base.json'),
    fileName: 'mcp_config.json',
  },
  {
    client: 'vscode',
    fixture: join('vscode', 'workspace.mcp.base.json'),
    fileName: join('.vscode', 'mcp.json'),
  },
];

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

  it.each(FIXTURES)('prints a unified diff without writing changes (%s)', async ({
    client,
    fixture,
    fileName,
  }) => {
    const tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'vibe-dryrun-'));
    const configPath = join(tmpDir, fileName);
    await fs.mkdir(dirname(configPath), { recursive: true });
    const fixturePath = join(process.cwd(), 'tests', 'fixtures', fixture);
    const original = readFileSync(fixturePath, 'utf8');
    await fs.writeFile(configPath, original, 'utf8');

    process.env.ANTHROPIC_API_KEY = 'sk-ant-dry-run-key';

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
      client,
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
