import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureEnv, homeConfigDir, PROVIDER_ENV_KEYS } from '../src/cli/env.js';

const VALID_PROVIDER_VALUES: Record<(typeof PROVIDER_ENV_KEYS)[number], string> = {
  ANTHROPIC_API_KEY: 'sk-ant-valid',
  OPENAI_API_KEY: 'sk-valid',
  GEMINI_API_KEY: 'AI-valid',
  OPENROUTER_API_KEY: 'sk-or-valid',
};

const ORIGINAL_ENV = { ...process.env };
describe('ensureEnv', () => {
  beforeEach(() => {
    process.exitCode = undefined;
    process.env = { ...ORIGINAL_ENV };
    for (const key of PROVIDER_ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it.each(PROVIDER_ENV_KEYS)(
    'returns without writing when %s is present non-interactively',
    async (key) => {
      process.env[key] = VALID_PROVIDER_VALUES[key];

      const result = await ensureEnv({ interactive: false });
      expect(result.wrote).toBe(false);
      expect(result.path).toBeUndefined();
      expect(result.missing).toBeUndefined();
    },
  );

  it('surfaces invalid optional keys even when another provider is set non-interactively', async () => {
    process.env.ANTHROPIC_API_KEY = VALID_PROVIDER_VALUES.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'totally-invalid';

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await ensureEnv({ interactive: false });

    expect(result.wrote).toBe(false);
    expect(result.missing).toContain('OPENAI_API_KEY');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid OPENAI_API_KEY'),
    );

    logSpy.mockRestore();
  });

  it('reports missing values when non-interactive', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await ensureEnv({ interactive: false });

    expect(result.wrote).toBe(false);
    expect(result.missing).toEqual([...PROVIDER_ENV_KEYS]);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('No provider API keys detected'),
    );
    logSpy.mockRestore();
  });

  it('writes missing secrets to the home config when interactive', async () => {
    const tmpHome = await fs.mkdtemp(join(os.tmpdir(), 'vibe-env-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);

    const prompt = vi.fn().mockImplementation(async (key: string) => {
      if (key === 'ANTHROPIC_API_KEY') {
        return 'sk-ant-interactive-secret';
      }
      return '';
    });

    const result = await ensureEnv({ interactive: true, prompt });
    expect(prompt).toHaveBeenCalledWith('ANTHROPIC_API_KEY');
    expect(prompt.mock.calls.length).toBe(1);
    expect(result.wrote).toBe(true);
    expect(result.path).toBe(join(homeConfigDir(), '.env'));

    const stat = await fs.stat(result.path as string);
    expect(stat.mode & 0o777).toBe(0o600);

    const content = await fs.readFile(result.path as string, 'utf8');
    expect(content).toContain('ANTHROPIC_API_KEY=sk-ant-interactive-secret');
    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-interactive-secret');
  });

  it('loads missing secrets from existing env files', async () => {
    const tmpHome = await fs.mkdtemp(join(os.tmpdir(), 'vibe-env-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);

    const homeDir = join(tmpHome, '.vibe-check');
    await fs.mkdir(homeDir, { recursive: true });
    await fs.writeFile(join(homeDir, '.env'), 'OPENAI_API_KEY=sk-from-file\n', 'utf8');

    const result = await ensureEnv({ interactive: false });
    expect(result.wrote).toBe(false);
    expect(process.env.OPENAI_API_KEY).toBe('sk-from-file');
  });

  it('appends new secrets to the local project env file', async () => {
    const tmpDir = await fs.mkdtemp(join(os.tmpdir(), 'vibe-env-local-'));
    const originalCwd = process.cwd();
    await fs.writeFile(join(tmpDir, '.env'), 'EXISTING=value\n', 'utf8');

    try {
      process.chdir(tmpDir);
      const prompt = vi.fn().mockImplementation(async (key: string) => {
        if (key === 'GEMINI_API_KEY') {
          return 'AI value with spaces';
        }
        return '';
      });

      const result = await ensureEnv({ interactive: true, local: true, prompt });
      expect(result.path).toBe(join(tmpDir, '.env'));

      const content = await fs.readFile(result.path as string, 'utf8');
      expect(content).toContain('EXISTING=value');
      expect(content).toMatch(/GEMINI_API_KEY="AI value with spaces"/);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('honors requiredKeys in non-interactive mode', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await ensureEnv({ interactive: false, requiredKeys: ['ANTHROPIC_API_KEY'] });

    expect(result.wrote).toBe(false);
    expect(result.missing).toEqual(['ANTHROPIC_API_KEY']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Missing required API keys'));

    logSpy.mockRestore();
  });

  it('prompts for each required key when interactive', async () => {
    const tmpHome = await fs.mkdtemp(join(os.tmpdir(), 'vibe-env-required-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);

    const prompt = vi
      .fn()
      .mockImplementation(async (key: string) =>
        key === 'ANTHROPIC_API_KEY' ? 'sk-ant-anthropic-123' : 'sk-openai-456',
      );

    const result = await ensureEnv({
      interactive: true,
      requiredKeys: ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY'],
      prompt,
    });

    expect(prompt.mock.calls.map((call) => call[0])).toEqual([
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
    ]);
    expect(result.wrote).toBe(true);
    expect(result.path).toBe(join(homeConfigDir(), '.env'));

    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-anthropic-123');
    expect(process.env.OPENAI_API_KEY).toBe('sk-openai-456');

    const content = await fs.readFile(result.path as string, 'utf8');
    expect(content).toContain('ANTHROPIC_API_KEY=sk-ant-anthropic-123');
    expect(content).toContain('OPENAI_API_KEY=sk-openai-456');
  });

  it('prompts to correct invalid optional keys when another provider is configured', async () => {
    const tmpHome = await fs.mkdtemp(join(os.tmpdir(), 'vibe-env-invalid-optional-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);

    process.env.ANTHROPIC_API_KEY = VALID_PROVIDER_VALUES.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'bad-value';

    const prompt = vi.fn().mockResolvedValue('sk-openai-corrected');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await ensureEnv({ interactive: true, prompt });

    expect(prompt).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenCalledWith('OPENAI_API_KEY');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid OPENAI_API_KEY'));
    expect(result.wrote).toBe(true);
    expect(process.env.OPENAI_API_KEY).toBe('sk-openai-corrected');

    const content = await fs.readFile(join(homeConfigDir(), '.env'), 'utf8');
    expect(content).toContain('OPENAI_API_KEY=sk-openai-corrected');

    logSpy.mockRestore();
  });

  it('re-prompts when provided values fail validation', async () => {
    const tmpHome = await fs.mkdtemp(join(os.tmpdir(), 'vibe-env-retry-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);

    const prompt = vi
      .fn()
      .mockResolvedValueOnce('invalid')
      .mockResolvedValueOnce('sk-ant-correct');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await ensureEnv({
      interactive: true,
      requiredKeys: ['ANTHROPIC_API_KEY'],
      prompt,
    });

    expect(prompt).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid ANTHROPIC_API_KEY'));
    expect(result.wrote).toBe(true);
    expect(process.env.ANTHROPIC_API_KEY).toBe('sk-ant-correct');

    logSpy.mockRestore();
  });

  it('fails immediately when non-interactive values are invalid', async () => {
    const tmpHome = await fs.mkdtemp(join(os.tmpdir(), 'vibe-env-invalid-'));
    vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);

    const homeDir = join(tmpHome, '.vibe-check');
    await fs.mkdir(homeDir, { recursive: true });
    await fs.writeFile(join(homeDir, '.env'), 'OPENAI_API_KEY=not-valid\n', 'utf8');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await ensureEnv({ interactive: false, requiredKeys: ['OPENAI_API_KEY'] });

    expect(result.wrote).toBe(false);
    expect(result.missing).toEqual(['OPENAI_API_KEY']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid OPENAI_API_KEY'));

    logSpy.mockRestore();
  });
});
