import { promises as fs } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import vscodeAdapter from '../src/cli/clients/vscode.js';
import { MergeOpts } from '../src/cli/clients/shared.js';
import { createCliProgram } from '../src/cli/index.js';

const SENTINEL = 'vibe-check-mcp-cli';
const FIXTURE_DIR = join(process.cwd(), 'tests', 'fixtures', 'vscode');

function loadFixture(name: string): Record<string, unknown> {
  const raw = readFileSync(join(FIXTURE_DIR, name), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

describe('VS Code MCP config merge', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.exitCode = undefined;
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('appends the managed entry under servers', () => {
    const base = loadFixture('workspace.mcp.base.json');
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

    const result = vscodeAdapter.merge(base, entry, options);
    expect(result.changed).toBe(true);
    const next = result.next.servers as Record<string, any>;
    expect(next['vibe-check-mcp']).toEqual({
      command: 'npx',
      args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
      env: {},
      transport: 'stdio',
      managedBy: SENTINEL,
    });
  });

  it('adds dev configuration when requested', () => {
    const base = loadFixture('workspace.mcp.base.json');
    const entry = {
      command: 'npx',
      args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
      env: {},
    } as const;
    const options: MergeOpts = {
      id: 'vibe-check-mcp',
      sentinel: SENTINEL,
      transport: 'stdio',
      dev: {
        watch: true,
        debug: 'node',
      },
    };

    const result = vscodeAdapter.merge(base, entry, options);
    const server = (result.next.servers as Record<string, any>)['vibe-check-mcp'];
    expect(server.dev).toEqual({ watch: true, debug: 'node' });
  });

  it('creates a backup and writes via CLI install', async () => {
    const tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'vscode-merge-'));
    const configDir = join(tmpDir, '.vscode');
    await fs.mkdir(configDir, { recursive: true });
    const configPath = join(configDir, 'mcp.json');
    const original = readFileSync(join(FIXTURE_DIR, 'workspace.mcp.base.json'), 'utf8');
    await fs.writeFile(configPath, original, 'utf8');

    process.env.OPENROUTER_API_KEY = 'sk-or-vscode-key';

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const program = createCliProgram();
    await program.parseAsync([
      'node',
      'vibe-check-mcp',
      'install',
      '--client',
      'vscode',
      '--config',
      configPath,
      '--non-interactive',
      '--dev-watch',
      '--dev-debug',
      'node',
    ]);

    logSpy.mockRestore();
    warnSpy.mockRestore();

    const files = await fs.readdir(configDir);
    const backup = files.find((file) => file.endsWith('.bak'));
    expect(backup).toBeDefined();

    if (backup) {
      const backupContent = await fs.readFile(join(configDir, backup), 'utf8');
      expect(backupContent).toBe(original);
    }

    const finalContent = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(finalContent) as Record<string, any>;
    expect(parsed.servers['vibe-check-mcp']).toEqual({
      command: 'npx',
      args: ['-y', '@pv-bhat/vibe-check-mcp', 'start', '--stdio'],
      env: {},
      transport: 'stdio',
      dev: {
        watch: true,
        debug: 'node',
      },
      managedBy: SENTINEL,
    });
  });
});
