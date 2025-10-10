import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import os from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const prompts: string[] = [];
const answers: string[] = [];
const closers: Array<() => void> = [];

vi.mock('node:readline/promises', () => ({
  createInterface: () => ({
    question: (prompt: string) => {
      prompts.push(prompt);
      const answer = answers.shift() ?? '';
      return Promise.resolve(answer);
    },
    close: () => {
      const closer = closers.shift();
      closer?.();
    },
  }),
}));

import { ensureEnv } from '../src/cli/env.js';

function resetQueues(): void {
  prompts.length = 0;
  answers.length = 0;
  closers.length = 0;
}

afterEach(() => {
  delete process.env.VIBE_CHECK_API_KEY;
  resetQueues();
  vi.restoreAllMocks();
});

describe('ensureEnv', () => {
  it('skips writing when env is already provided in non-interactive mode', async () => {
    process.env.VIBE_CHECK_API_KEY = 'present';

    const result = await ensureEnv({ interactive: false, local: false });

    expect(result.wrote).toBe(false);
    expect(prompts).toHaveLength(0);
  });

  it('prompts for missing secrets and writes ~/.vibe-check/.env', async () => {
    const tempHome = await fs.mkdtemp(join(tmpdir(), 'env-home-'));
    const homeSpy = vi.spyOn(os, 'homedir').mockReturnValue(tempHome);
    const closeSpy = vi.fn();
    closers.push(closeSpy);
    answers.push('secret-value');

    const result = await ensureEnv({ interactive: true, local: false });

    expect(result.wrote).toBe(true);
    expect(result.path).toBe(join(tempHome, '.vibe-check', '.env'));
    const stat = await fs.stat(result.path!);
    expect(stat.mode & 0o777).toBe(0o600);
    const content = await fs.readFile(result.path!, 'utf8');
    expect(content).toContain('VIBE_CHECK_API_KEY=secret-value');
    expect(process.env.VIBE_CHECK_API_KEY).toBe('secret-value');
    expect(closeSpy).toHaveBeenCalled();

    await fs.rm(tempHome, { recursive: true, force: true });
    homeSpy.mockRestore();
  });
});
