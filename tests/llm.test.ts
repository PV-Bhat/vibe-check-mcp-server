import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { generateResponse, __testing } from '../src/utils/llm.js';

vi.mock('axios');
const mockedAxios = axios as unknown as { post: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  __testing.setGenAI({
    getGenerativeModel: vi.fn(() => ({
      generateContent: vi.fn(async () => ({ response: { text: () => 'gemini reply' } }))
    }))
  });
  __testing.setOpenAIClient({
    chat: { completions: { create: vi.fn(async () => ({ choices: [{ message: { content: 'openai reply' } }] })) } }
  });
});

describe('generateResponse', () => {
  it('uses gemini by default and builds prompt with context', async () => {
    const res = await generateResponse({ goal: 'G', plan: 'P', uncertainties: ['u1'], historySummary: 'Hist' });
    expect(res.questions).toBe('gemini reply');
    const gen = __testing.getGenAI();
    expect(gen.getGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-2.5-pro' });
    const prompt = gen.getGenerativeModel.mock.results[0].value.generateContent.mock.calls[0][0];
    expect(prompt).toContain('History Context: Hist');
    expect(prompt).toContain('u1');
  });

  it('uses openai when overridden', async () => {
    const openai = __testing.getOpenAIClient();
    const res = await generateResponse({ goal: 'g', plan: 'p', modelOverride: { provider: 'openai', model: 'o1-mini' } });
    expect(res.questions).toBe('openai reply');
    expect(openai.chat.completions.create).toHaveBeenCalledWith({ model: 'o1-mini', messages: [{ role: 'system', content: expect.any(String) }] });
  });

  it('throws if openrouter key missing', async () => {
    await expect(generateResponse({ goal: 'g', plan: 'p', modelOverride: { provider: 'openrouter', model: 'm1' } })).rejects.toThrow('OpenRouter API key');
  });

  it('calls openrouter when configured', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-key';
    mockedAxios.post = vi.fn(async () => ({ data: { choices: [{ message: { content: 'router reply' } }] } }));
    const res = await generateResponse({ goal: 'g', plan: 'p', modelOverride: { provider: 'openrouter', model: 'm1' } });
    expect(res.questions).toBe('router reply');
    expect(mockedAxios.post).toHaveBeenCalled();
    delete process.env.OPENROUTER_API_KEY;
  });
});
