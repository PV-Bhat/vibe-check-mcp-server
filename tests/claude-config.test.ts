import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import os from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  locateClaudeConfig,
  readClaudeConfig,
  writeClaudeConfigAtomic,
} from '../src/cli/clients/claude.js';

const ORIGINAL_ENV = { ...process.env };

describe('Claude config helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('expands custom paths with a tilde', async () => {
    const tmpHome = await fs.mkdtemp(join(os.tmpdir(), 'claude-home-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);

    const result = await locateClaudeConfig('~/config.json');
    expect(result).toBe(join(tmpHome, 'config.json'));
  });

  it('expands custom paths with a tilde and backslash', async () => {
    const tmpHome = await fs.mkdtemp(join(os.tmpdir(), 'claude-home-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);

    const result = await locateClaudeConfig('~\\config.json');
    expect(result).toBe(join(tmpHome, 'config.json'));
  });

  it('locates the default macOS path when present', async () => {
    const tmpHome = await fs.mkdtemp(join(os.tmpdir(), 'claude-home-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');

    const candidate = join(
      tmpHome,
      'Library',
      'Application Support',
      'Claude',
      'claude_desktop_config.json',
    );
    await fs.mkdir(dirname(candidate), { recursive: true });
    await fs.writeFile(candidate, '{}', 'utf8');

    const result = await locateClaudeConfig();
    expect(result).toBe(candidate);

    platformSpy.mockRestore();
  });

  it('locates the config via APPDATA on Windows', async () => {
    const tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'claude-appdata-'));
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');

    const originalAppData = process.env.APPDATA;
    process.env.APPDATA = join(tmpDir, 'AppData');

    const candidate = join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json');
    await fs.mkdir(dirname(candidate), { recursive: true });
    await fs.writeFile(candidate, '{}', 'utf8');

    const result = await locateClaudeConfig();
    expect(result).toBe(candidate);

    if (originalAppData === undefined) {
      delete process.env.APPDATA;
    } else {
      process.env.APPDATA = originalAppData;
    }
    platformSpy.mockRestore();
  });

  it('prefers XDG config directories on Linux', async () => {
    const tmpHome = await fs.mkdtemp(join(os.tmpdir(), 'claude-home-'));
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);

    const xdgDir = await fs.mkdtemp(join(os.tmpdir(), 'claude-xdg-'));
    process.env.XDG_CONFIG_HOME = xdgDir;

    const candidate = join(xdgDir, 'Claude', 'claude_desktop_config.json');
    await fs.mkdir(dirname(candidate), { recursive: true });
    await fs.writeFile(candidate, '{}', 'utf8');

    const result = await locateClaudeConfig();
    expect(result).toBe(candidate);

    platformSpy.mockRestore();
  });

  it('returns null when no candidates exist', async () => {
    const platformSpy = vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    const tmpHome = await fs.mkdtemp(join(os.tmpdir(), 'claude-home-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);
    process.env.XDG_CONFIG_HOME = '';

    const result = await locateClaudeConfig();
    expect(result).toBeNull();

    platformSpy.mockRestore();
  });

  it('writes configs atomically with 0600 permissions', async () => {
    const tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'claude-write-'));
    const target = join(tmpDir, 'config.json');

    await writeClaudeConfigAtomic(target, { hello: 'world' });

    const stat = await fs.stat(target);
    expect(stat.mode & 0o777).toBe(0o600);

    const content = await fs.readFile(target, 'utf8');
    expect(JSON.parse(content)).toEqual({ hello: 'world' });
  });

  it('throws when config JSON is not an object', async () => {
    const tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'claude-read-'));
    const target = join(tmpDir, 'config.json');
    await fs.writeFile(target, '"string"', 'utf8');

    await expect(readClaudeConfig(target)).rejects.toThrow('Claude config must be a JSON object.');
  });
});
