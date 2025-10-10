import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCliProgram } from '../src/cli/index.js';

async function copyFixture(): Promise<{ configPath: string; dir: string }> {
  const sourcePath = join(process.cwd(), 'tests', 'fixtures', 'claude', 'config.base.json');
  const dir = await fs.mkdtemp(join(tmpdir(), 'claude-dryrun-'));
  const target = join(dir, 'claude_desktop_config.json');
  const data = await fs.readFile(sourcePath, 'utf8');
  await fs.writeFile(target, data);
  return { configPath: target, dir };
}

afterEach(() => {
  delete process.env.VIBE_CHECK_API_KEY;
  vi.restoreAllMocks();
});

describe('cli install --dry-run', () => {
  it('prints a diff without modifying the config file', async () => {
    const { configPath, dir } = await copyFixture();
    const original = await fs.readFile(configPath, 'utf8');
    process.env.VIBE_CHECK_API_KEY = 'test-key';

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const program = createCliProgram();
    await program.parseAsync(
      ['install', '--client', 'claude', '--dry-run', '--non-interactive', '--config', configPath],
      { from: 'user' },
    );

    const updated = await fs.readFile(configPath, 'utf8');
    expect(updated).toBe(original);

    const combinedLogs = [...logSpy.mock.calls.flat(), ...warnSpy.mock.calls.flat()].join('\n');
    expect(combinedLogs).toContain('Dry run: no changes written');
    expect(combinedLogs).toContain('@@');

    await fs.rm(dir, { recursive: true, force: true });
  });
});
