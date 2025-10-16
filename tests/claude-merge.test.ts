import { promises as fs } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { createCliProgram } from '../src/cli/index.js';
import { mergeMcpEntry } from '../src/cli/clients/claude.js';

const SENTINEL = 'vibe-check-mcp-cli';
const FIXTURE_DIR = join(process.cwd(), 'tests', 'fixtures', 'claude');

function loadFixture(name: string): Record<string, unknown> {
  const raw = readFileSync(join(FIXTURE_DIR, name), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('Claude MCP config merge', () => {
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
    const entry = {
      command: 'npx',
      args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
      env: {},
    };

    const result = mergeMcpEntry(base, entry, { id: 'vibe-check-mcp', sentinel: SENTINEL });
    expect(result.changed).toBe(true);
    expect(result.next.mcpServers).toMatchObject({
      'vibe-check-mcp': {
        command: 'npx',
        args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
        env: {},
        managedBy: SENTINEL,
      },
    });
    expect(result.next.mcpServers).toHaveProperty('other-server');
  });

  it('updates an existing managed entry in place', () => {
    const base = loadFixture('config.with-managed-entry.json');
    const entry = {
      command: 'npx',
      args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
      env: {},
    };

    const result = mergeMcpEntry(base, entry, { id: 'vibe-check-mcp', sentinel: SENTINEL });
    expect(result.changed).toBe(true);
    const nextServers = result.next.mcpServers as Record<string, unknown>;
    expect(nextServers['vibe-check-mcp']).toEqual({
      command: 'npx',
      args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
      env: {},
      managedBy: SENTINEL,
    });
  });

  it('skips unmanaged entries with the same id', () => {
    const base = loadFixture('config.with-other-servers.json');
    const entry = {
      command: 'npx',
      args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
      env: {},
    };

    const result = mergeMcpEntry(base, entry, { id: 'vibe-check-mcp', sentinel: SENTINEL });
    expect(result.changed).toBe(false);
    expect(result.reason).toContain('not managed');
    expect(result.next).toEqual(base);
  });

  it('writes atomically and creates a backup when installing via CLI', async () => {
    const tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'vibe-claude-'));
    const configPath = join(tmpDir, 'claude.json');
    const fixturePath = join(FIXTURE_DIR, 'config.base.json');
    const original = readFileSync(fixturePath, 'utf8');
    await fs.writeFile(configPath, original, 'utf8');

    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-token';

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
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
      '--non-interactive',
    ]);

    logSpy.mockRestore();
    warnSpy.mockRestore();

    const files = await fs.readdir(tmpDir);
    const backup = files.find((file) => file.endsWith('.bak'));
    expect(backup).toBeDefined();
    const backupContent = await fs.readFile(join(tmpDir, backup as string), 'utf8');
    expect(backupContent).toBe(original);

    const finalContent = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(finalContent) as Record<string, any>;
    expect(parsed.mcpServers['vibe-check-mcp']).toEqual({
      command: 'npx',
      args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
      env: {},
      managedBy: SENTINEL,
    });
    expect(parsed.mcpServers).toHaveProperty('other-server');
  });
});
