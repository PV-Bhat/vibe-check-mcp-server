import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { format } from 'node:util';
import { createCliProgram } from '../src/cli/index.js';
import * as doctor from '../src/cli/doctor.js';

function captureLogs() {
  const info: string[] = [];
  const warnings: string[] = [];

  const logSpy = vi.spyOn(console, 'log').mockImplementation((message?: unknown, ...rest: unknown[]) => {
    info.push(format(String(message ?? ''), ...rest));
  });

  const warnSpy = vi.spyOn(console, 'warn').mockImplementation((message?: unknown, ...rest: unknown[]) => {
    warnings.push(format(String(message ?? ''), ...rest));
  });

  return { info, warnings, restore: () => { logSpy.mockRestore(); warnSpy.mockRestore(); } };
}

describe('cli doctor node version reporting', () => {
  beforeEach(() => {
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports ok when version satisfies requirement', async () => {
    vi.spyOn(doctor, 'checkNodeVersion').mockReturnValue({ ok: true, current: 'v20.5.0' });
    vi.spyOn(doctor, 'detectEnvFiles').mockReturnValue({ cwdEnv: null, homeEnv: null });

    const { info, warnings, restore } = captureLogs();
    const program = createCliProgram();

    await program.parseAsync(['node', 'vibe-check-mcp', 'doctor']);

    restore();
    expect(warnings).toHaveLength(0);
    expect(info.join('\n')).toContain('meets');
    expect(process.exitCode).toBeUndefined();
  });

  it('warns when version is below requirement', async () => {
    vi.spyOn(doctor, 'checkNodeVersion').mockReturnValue({ ok: false, current: 'v18.0.0' });
    vi.spyOn(doctor, 'detectEnvFiles').mockReturnValue({ cwdEnv: null, homeEnv: null });

    const { warnings, restore } = captureLogs();
    const program = createCliProgram();

    await program.parseAsync(['node', 'vibe-check-mcp', 'doctor']);

    restore();
    expect(warnings.join('\n')).toContain('requires');
    expect(process.exitCode).toBe(1);
  });
});
