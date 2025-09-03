import { describe, it, expect } from 'vitest';
import { updateConstitution, resetConstitution, getConstitution, __testing } from '../src/tools/constitution.js';

describe('constitution utilities', () => {
  it('updates, resets, and retrieves rules', () => {
    updateConstitution('s1', 'r1');
    updateConstitution('s1', 'r2');
    expect(getConstitution('s1')).toEqual(['r1', 'r2']);

    resetConstitution('s1', ['a']);
    expect(getConstitution('s1')).toEqual(['a']);
  });

  it('cleans up stale sessions', () => {
    updateConstitution('s2', 'rule');
    const map = __testing._getMap();
    map['s2'].updated = Date.now() - 2 * 60 * 60 * 1000;
    __testing.cleanup();
    expect(getConstitution('s2')).toEqual([]);
  });
});
