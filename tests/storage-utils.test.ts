import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

type StorageModule = typeof import('../src/utils/storage.js');

let tempDir: string;
let storage: StorageModule;

async function loadStorageModule(dir: string): Promise<StorageModule> {
  vi.resetModules();
  vi.doMock('os', () => ({
    default: {
      homedir: () => dir,
    },
  }));
  const mod = await import('../src/utils/storage.js');
  return mod;
}

afterEach(() => {
  vi.doUnmock('os');
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('storage utilities', () => {
  it('writes and reads log data safely', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-storage-test-'));
    storage = await loadStorageModule(tempDir);

    const logPath = path.join(tempDir, '.vibe-check', 'vibe-log.json');

    const mockLog = {
      mistakes: {
        Example: {
          count: 1,
          examples: [
            {
              type: 'mistake' as const,
              category: 'Example',
              mistake: 'Did something wrong.',
              solution: 'Fixed it quickly.',
              timestamp: Date.now(),
            },
          ],
          lastUpdated: Date.now(),
        },
      },
      lastUpdated: Date.now(),
    };

    storage.writeLogFile(mockLog);
    expect(fs.existsSync(logPath)).toBe(true);
    const readBack = storage.readLogFile();
    expect(readBack.mistakes.Example.count).toBe(1);

    fs.writeFileSync(logPath, 'not-json');
    const fallback = storage.readLogFile();
    expect(fallback.mistakes).toEqual({});
  });

  it('tracks learning entries and summaries', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-storage-test-'));
    storage = await loadStorageModule(tempDir);

    storage.addLearningEntry('Missed tests', 'Feature Creep', 'Add coverage', 'mistake');
    storage.addLearningEntry('Shipped fast', 'Success', undefined, 'success');
    storage.addLearningEntry('Too many tools', 'Overtooling', 'Simplify stack', 'mistake');

    const entries = storage.getLearningEntries();
    expect(Object.keys(entries)).toEqual(expect.arrayContaining(['Feature Creep', 'Success', 'Overtooling']));

    const summary = storage.getLearningCategorySummary();
    expect(summary[0].count).toBeGreaterThan(0);
    expect(summary.some((item) => item.category === 'Feature Creep')).toBe(true);

    const context = storage.getLearningContextText(2);
    expect(context).toContain('Category: Feature Creep');
    expect(context).toContain('Mistake');
  });
});
