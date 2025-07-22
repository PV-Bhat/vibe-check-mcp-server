import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import { loadHistory, getHistorySummary, addToHistory } from '../src/utils/state.js';

vi.mock('fs/promises');
const mockedFs = fs as unknown as { readFile: ReturnType<typeof vi.fn>; writeFile: ReturnType<typeof vi.fn>; mkdir: ReturnType<typeof vi.fn>; };

beforeEach(async () => {
  vi.clearAllMocks();
  mockedFs.mkdir = vi.fn();
  mockedFs.readFile = vi.fn().mockResolvedValue('{}');
  mockedFs.writeFile = vi.fn();
  await loadHistory();
});

describe('state history', () => {
  it('initializes empty history if none', async () => {
    mockedFs.readFile.mockRejectedValue(new Error('missing'));
    await loadHistory();
    expect(getHistorySummary('none')).toBe('');
  });

  it('adds to history and trims to 10', async () => {
    mockedFs.readFile.mockRejectedValue(new Error('missing'));
    await loadHistory();
    for (let i = 1; i <= 11; i++) {
      addToHistory('sess', { goal: `g${i}`, plan: `p${i}` }, `o${i}`);
    }
    await Promise.resolve();
    const summary = getHistorySummary('sess');
    expect(summary).toContain('g7');
    expect(summary).not.toContain('g2');
  });
});
