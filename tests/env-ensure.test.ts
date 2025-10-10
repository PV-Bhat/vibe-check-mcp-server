import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureEnv, homeConfigDir } from '../src/cli/env.js';

const ORIGINAL_ENV = { ...process.env };
describe('ensureEnv', () => {
  beforeEach(() => {
    process.exitCode = undefined;
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns without writing when all values are present non-interactively', async () => {
    process.env.VIBE_CHECK_API_KEY = 'present';

    const result = await ensureEnv({ interactive: false });
    expect(result.wrote).toBe(false);
    expect(result.path).toBeUndefined();
    expect(result.missing).toBeUndefined();
  });

  it('writes missing secrets to the home config when interactive', async () => {
    const tmpHome = await fs.mkdtemp(join(os.tmpdir(), 'vibe-env-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);

    const prompt = vi.fn().mockResolvedValue('interactive-secret');

    const result = await ensureEnv({ interactive: true, prompt });
    expect(prompt).toHaveBeenCalledWith('VIBE_CHECK_API_KEY');
    expect(result.wrote).toBe(true);
    expect(result.path).toBe(join(homeConfigDir(), '.env'));

    const stat = await fs.stat(result.path as string);
    expect(stat.mode & 0o777).toBe(0o600);

    const content = await fs.readFile(result.path as string, 'utf8');
    expect(content).toContain('VIBE_CHECK_API_KEY=interactive-secret');
    expect(process.env.VIBE_CHECK_API_KEY).toBe('interactive-secret');
  });
});
