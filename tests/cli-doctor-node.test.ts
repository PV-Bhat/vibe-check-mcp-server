import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkNodeVersion } from '../src/cli/doctor.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('doctor node version check', () => {
  it('flags versions below the required range', () => {
    vi.spyOn(process, 'version', 'get').mockReturnValue('v18.19.0');

    const result = checkNodeVersion('>=20.0.0');

    expect(result.ok).toBe(false);
    expect(result.current).toBe('18.19.0');
  });

  it('accepts versions that satisfy the requirement', () => {
    vi.spyOn(process, 'version', 'get').mockReturnValue('v20.11.1');

    const result = checkNodeVersion('>=20.0.0');

    expect(result.ok).toBe(true);
    expect(result.current).toBe('20.11.1');
  });
});

