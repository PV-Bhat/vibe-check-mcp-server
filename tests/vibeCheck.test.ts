import { vi, describe, it, expect, beforeEach } from 'vitest';
import { vibeCheckTool } from '../src/tools/vibeCheck.js';
import * as llm from '../src/utils/llm.js';
import * as state from '../src/utils/state.js';

vi.mock('../src/utils/llm.js');
vi.mock('../src/utils/state.js');

const mockedLLM = llm as unknown as { getMetacognitiveQuestions: ReturnType<typeof vi.fn> };
const mockedState = state as unknown as {
  addToHistory: ReturnType<typeof vi.fn>;
  getHistorySummary: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedState.getHistorySummary = vi.fn().mockReturnValue('Mock history');
  mockedState.addToHistory = vi.fn();
  mockedLLM.getMetacognitiveQuestions = vi.fn().mockResolvedValue({ questions: 'Mock guidance' });
});

describe('vibeCheckTool', () => {
  it('returns questions from llm', async () => {
    const result = await vibeCheckTool({ goal: 'Test goal', plan: 'Test plan' });
    expect(result.questions).toBe('Mock guidance');
    expect(mockedLLM.getMetacognitiveQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ goal: 'Test goal', plan: 'Test plan', historySummary: 'Mock history' })
    );
  });

  it('passes model override to llm', async () => {
    await vibeCheckTool({ goal: 'g', plan: 'p', modelOverride: { provider: 'openai' } });
    expect(mockedLLM.getMetacognitiveQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ modelOverride: { provider: 'openai' } })
    );
  });

  it('adds to history on each call', async () => {
    await vibeCheckTool({ goal: 'A', plan: 'B', sessionId: 's1' });
    await vibeCheckTool({ goal: 'C', plan: 'D', sessionId: 's1' });
    expect(mockedState.addToHistory).toHaveBeenCalledTimes(2);
  });

  it('falls back to default questions when llm fails', async () => {
    mockedLLM.getMetacognitiveQuestions = vi.fn().mockRejectedValue(new Error('fail'));
    const result = await vibeCheckTool({ goal: 'x', plan: 'y' });
    expect(result.questions).toContain('Does this plan directly address');
  });
});
