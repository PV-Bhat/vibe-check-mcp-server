import { promises as fs } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import cursorAdapter from '../src/cli/clients/cursor.js';
import { MergeOpts } from '../src/cli/clients/shared.js';
import { createCliProgram } from '../src/cli/index.js';

const SENTINEL = 'vibe-check-mcp-cli';
const FIXTURE_DIR = join(process.cwd(), 'tests', 'fixtures', 'cursor');

function loadFixture(name: string): Record<string, unknown> {
  const raw = readFileSync(join(FIXTURE_DIR, name), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

const ENTRY = {
  command: 'npx',
  args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
  env: {},
} as const;

const MERGE_OPTS: MergeOpts = {
  id: 'vibe-check-mcp',
  sentinel: SENTINEL,
  transport: 'stdio',
};

describe('Cursor MCP config merge', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.exitCode = undefined;
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('appends the managed entry to a base config', () => {
    const base = loadFixture('config.base.json');
    const result = cursorAdapter.merge(base, ENTRY, MERGE_OPTS);
    expect(result.changed).toBe(true);
    expect(result.next.mcpServers).toMatchObject({
      'vibe-check-mcp': {
        command: 'npx',
        args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
        env: {},
        managedBy: SENTINEL,
      },
    });
  });

  it('updates an existing managed entry in place', () => {
    const base = loadFixture('config.with-managed-entry.json');
    const result = cursorAdapter.merge(base, ENTRY, MERGE_OPTS);
    expect(result.changed).toBe(true);
    const next = result.next.mcpServers as Record<string, unknown>;
    expect(next['vibe-check-mcp']).toEqual({
      command: 'npx',
      args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
      env: {},
      managedBy: SENTINEL,
    });
  });

  it('does not replace an unmanaged entry', () => {
    const base = loadFixture('../claude/config.with-other-servers.json');
    const result = cursorAdapter.merge(base, ENTRY, MERGE_OPTS);
    expect(result.changed).toBe(false);
    expect(result.reason).toContain('not managed');
  });

  it('creates a backup and writes via the CLI install command', async () => {
    const tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'cursor-merge-'));
    const configPath = join(tmpDir, 'mcp.json');
    const original = readFileSync(join(FIXTURE_DIR, 'config.base.json'), 'utf8');
    await fs.writeFile(configPath, original, 'utf8');

    process.env.OPENAI_API_KEY = 'sk-cursor-key';

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const program = createCliProgram();
    await program.parseAsync([
      'node',
      'vibe-check-mcp',
      'install',
      '--client',
      'cursor',
      '--config',
      configPath,
      '--non-interactive',
    ]);

    logSpy.mockRestore();
    warnSpy.mockRestore();

    const files = await fs.readdir(tmpDir);
    const backup = files.find((file) => file.endsWith('.bak'));
    expect(backup).toBeDefined();
    if (backup) {
      const backupContent = await fs.readFile(join(tmpDir, backup), 'utf8');
      expect(backupContent).toBe(original);
    }

    const finalContent = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(finalContent) as Record<string, any>;
    expect(parsed.mcpServers['vibe-check-mcp']).toEqual({
      command: 'npx',
      args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
      env: {},
      managedBy: SENTINEL,
    });
  });
});
