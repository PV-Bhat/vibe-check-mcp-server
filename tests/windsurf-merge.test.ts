import { promises as fs } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import windsurfAdapter from '../src/cli/clients/windsurf.js';
import { MergeOpts } from '../src/cli/clients/shared.js';
import { createCliProgram } from '../src/cli/index.js';

const SENTINEL = 'vibe-check-mcp-cli';
const FIXTURE_DIR = join(process.cwd(), 'tests', 'fixtures', 'windsurf');

function loadFixture(name: string): Record<string, unknown> {
  const raw = readFileSync(join(FIXTURE_DIR, name), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('Windsurf MCP config merge', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.exitCode = undefined;
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('appends a stdio entry to a base config', () => {
    const base = loadFixture('config.base.json');
    const entry = {
      command: 'npx',
      args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
      env: {},
    } as const;
    const options: MergeOpts = {
      id: 'vibe-check-mcp',
      sentinel: SENTINEL,
      transport: 'stdio',
    };

    const result = windsurfAdapter.merge(base, entry, options);
    expect(result.changed).toBe(true);
    const next = result.next.mcpServers as Record<string, unknown>;
    expect(next['vibe-check-mcp']).toEqual({
      command: 'npx',
      args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
      env: {},
      managedBy: SENTINEL,
    });
  });

  it('preserves a managed http entry and updates the URL', () => {
    const base = loadFixture('config.with-http-entry.json');
    const entry = {
      command: 'npx',
      args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--http', '--port', '3000'],
      env: {},
    } as const;
    const options: MergeOpts = {
      id: 'vibe-check-mcp',
      sentinel: SENTINEL,
      transport: 'http',
      httpUrl: 'http://127.0.0.1:3000',
    };

    const result = windsurfAdapter.merge(base, entry, options);
    expect(result.changed).toBe(true);
    const next = result.next.mcpServers as Record<string, any>;
    expect(next['vibe-check-mcp']).toEqual({
      serverUrl: 'http://127.0.0.1:3000',
      managedBy: SENTINEL,
    });
  });

  it('does not replace unmanaged entries', () => {
    const base = loadFixture('../claude/config.with-other-servers.json');
    const entry = {
      command: 'npx',
      args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
      env: {},
    } as const;
    const options: MergeOpts = {
      id: 'vibe-check-mcp',
      sentinel: SENTINEL,
      transport: 'stdio',
    };

    const result = windsurfAdapter.merge(base, entry, options);
    expect(result.changed).toBe(false);
    expect(result.reason).toContain('not managed');
  });

  it('creates a backup and writes via CLI install', async () => {
    const tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'windsurf-merge-'));
    const configPath = join(tmpDir, 'mcp_config.json');
    const original = readFileSync(join(FIXTURE_DIR, 'config.base.json'), 'utf8');
    await fs.writeFile(configPath, original, 'utf8');

    process.env.GEMINI_API_KEY = 'AI-windsurf-key';

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const program = createCliProgram();
    await program.parseAsync([
      'node',
      'vibe-check-mcp',
      'install',
      '--client',
      'windsurf',
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
