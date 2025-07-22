import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vibeLearnTool } from '../src/tools/vibeLearn.js';
import * as storage from '../src/utils/storage.js';

vi.mock('../src/utils/storage.js');

const mockedStorage = storage as unknown as {
  addLearningEntry: ReturnType<typeof vi.fn>;
  getLearningCategorySummary: ReturnType<typeof vi.fn>;
  getLearningEntries: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedStorage.addLearningEntry = vi.fn(() => ({
    type: 'mistake',
    category: 'Test',
    mistake: 'm',
    solution: 's',
    timestamp: Date.now()
  }));
  mockedStorage.getLearningEntries = vi.fn(() => ({ Test: [] }));
  mockedStorage.getLearningCategorySummary = vi.fn(() => [{ category: 'Test', count: 1, recentExample: { mistake: 'm', solution: 's', type: 'mistake', timestamp: Date.now() } }]);
});

describe('vibeLearnTool', () => {
  it('logs entry and returns summary', async () => {
    const res = await vibeLearnTool({ mistake: 'm', category: 'Test', solution: 's' });
    expect(res.added).toBe(true);
    expect(mockedStorage.addLearningEntry).toHaveBeenCalled();
    expect(res.topCategories[0].category).toBe('Test');
  });
});
