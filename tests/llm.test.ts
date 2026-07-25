import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { generateResponse, __testing } from '../src/utils/llm.js';
import { DEFAULT_MODELS, GEMINI_FALLBACK_MODEL } from '../src/utils/models.js';

vi.mock('axios');
const mockedAxios = axios as unknown as { post: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.clearAllMocks();
  // Mirrors the unified @google/genai surface: ai.models.generateContent({...})
  // resolving to an object whose `text` is a plain string property.
  __testing.setGenAI({
    models: { generateContent: vi.fn(async () => ({ text: 'gemini reply' })) }
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
    expect(gen.models.generateContent).toHaveBeenCalledTimes(1);
    const [{ model, contents }] = gen.models.generateContent.mock.calls[0];
    expect(model).toBe(DEFAULT_MODELS.gemini);
    expect(contents).toContain('History Context: Hist');
    expect(contents).toContain('u1');
  });

  it('falls back to the secondary gemini model when the primary fails', async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(new Error('model unavailable'))
      .mockResolvedValueOnce({ text: 'fallback reply' });
    __testing.setGenAI({ models: { generateContent } });

    const res = await generateResponse({ goal: 'g', plan: 'p' });

    expect(res.questions).toBe('fallback reply');
    expect(generateContent.mock.calls[0][0].model).toBe(DEFAULT_MODELS.gemini);
    expect(generateContent.mock.calls[1][0].model).toBe(GEMINI_FALLBACK_MODEL);
  });

  it('does not retry when the failing gemini model is already the fallback', async () => {
    const generateContent = vi.fn().mockRejectedValue(new Error('model unavailable'));
    __testing.setGenAI({ models: { generateContent } });

    await expect(
      generateResponse({ goal: 'g', plan: 'p', modelOverride: { provider: 'gemini', model: GEMINI_FALLBACK_MODEL } })
    ).rejects.toThrow('model unavailable');
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('treats a blocked or empty gemini response as a failure', async () => {
    // The @google/genai `text` getter returns undefined for safety-blocked or
    // thought-only candidates instead of throwing; returning '' from here would
    // hand the agent a blank vibe check and skip both fallbacks.
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({ text: undefined, promptFeedback: { blockReason: 'SAFETY' } })
      .mockResolvedValueOnce({ text: 'fallback reply' });
    __testing.setGenAI({ models: { generateContent } });

    const res = await generateResponse({ goal: 'g', plan: 'p' });

    expect(res.questions).toBe('fallback reply');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('surfaces an error when every gemini attempt returns empty text', async () => {
    __testing.setGenAI({ models: { generateContent: vi.fn(async () => ({ text: '   ' })) } });

    await expect(generateResponse({ goal: 'g', plan: 'p' })).rejects.toThrow('no usable text');
  });

  it('ignores DEFAULT_MODEL when the call overrides the provider', async () => {
    // DEFAULT_MODEL names a model of DEFAULT_LLM_PROVIDER; forwarding a Gemini
    // model ID to OpenAI would 404 at the provider.
    process.env.DEFAULT_MODEL = 'gemini-3.6-flash';
    try {
      const openai = __testing.getOpenAIClient();
      await generateResponse({ goal: 'g', plan: 'p', modelOverride: { provider: 'openai' } });
      expect(openai.chat.completions.create).toHaveBeenCalledWith({
        model: DEFAULT_MODELS.openai,
        messages: [{ role: 'system', content: expect.any(String) }]
      });
    } finally {
      delete process.env.DEFAULT_MODEL;
    }
  });

  it('applies DEFAULT_MODEL when the provider is unchanged', async () => {
    process.env.DEFAULT_MODEL = 'gemini-2.5-pro';
    try {
      await generateResponse({ goal: 'g', plan: 'p' });
      const gen = __testing.getGenAI();
      expect(gen.models.generateContent.mock.calls[0][0].model).toBe('gemini-2.5-pro');
    } finally {
      delete process.env.DEFAULT_MODEL;
    }
  });

  it('uses openai when overridden', async () => {
    const openai = __testing.getOpenAIClient();
    const res = await generateResponse({ goal: 'g', plan: 'p', modelOverride: { provider: 'openai', model: 'gpt-5.6-luna' } });
    expect(res.questions).toBe('openai reply');
    expect(openai.chat.completions.create).toHaveBeenCalledWith({ model: 'gpt-5.6-luna', messages: [{ role: 'system', content: expect.any(String) }] });
  });

  it('defaults openai to the registry model', async () => {
    const openai = __testing.getOpenAIClient();
    await generateResponse({ goal: 'g', plan: 'p', modelOverride: { provider: 'openai' } });
    expect(openai.chat.completions.create).toHaveBeenCalledWith({
      model: DEFAULT_MODELS.openai,
      messages: [{ role: 'system', content: expect.any(String) }]
    });
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
