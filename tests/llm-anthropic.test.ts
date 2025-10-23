import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SUPPORTED_LLM_PROVIDERS } from '../src/index.js';
import { generateResponse } from '../src/utils/llm.js';

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

describe('Anthropic provider', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.ANTHROPIC_VERSION;
  });

  afterEach(() => {
    if (ORIGINAL_FETCH) {
      global.fetch = ORIGINAL_FETCH;
    } else {
      // @ts-expect-error allow deleting fetch when absent
      delete global.fetch;
    }
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('is exposed via the tool schema enum', () => {
    expect(SUPPORTED_LLM_PROVIDERS).toContain('anthropic');
  });

  it('sends requests to the default endpoint when using an API key', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-xxx';

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'anthropic reply' }],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await generateResponse({
      goal: 'Goal',
      plan: 'Plan',
      modelOverride: { provider: 'anthropic', model: 'claude-3-haiku' },
    });

    expect(result.questions).toBe('anthropic reply');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = (options as RequestInit).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-xxx');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers).not.toHaveProperty('authorization');

    const body = JSON.parse((options as RequestInit).body as string);
    expect(body).toMatchObject({
      model: 'claude-3-haiku',
      max_tokens: 1024,
    });
    expect(body.messages).toEqual([
      {
        role: 'user',
        content: expect.stringContaining('Goal: Goal'),
      },
    ]);
  });

  it('honors custom base URLs and bearer tokens', async () => {
    process.env.ANTHROPIC_BASE_URL = 'https://example.proxy/api/anthropic/';
    process.env.ANTHROPIC_AUTH_TOKEN = 'za_xxx';

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          content: [{ type: 'text', text: 'proxied reply' }],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await generateResponse({
      goal: 'Goal',
      plan: 'Plan',
      modelOverride: { provider: 'anthropic', model: 'claude-3-sonnet' },
    });

    expect(result.questions).toBe('proxied reply');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.proxy/api/anthropic/v1/messages');
    const headers = (options as RequestInit).headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer za_xxx');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers).not.toHaveProperty('x-api-key');
  });

  it('prefers API keys when both credentials are present', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-xxx';
    process.env.ANTHROPIC_AUTH_TOKEN = 'za_xxx';

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ content: [{ type: 'text', text: 'dual creds reply' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await generateResponse({
      goal: 'Goal',
      plan: 'Plan',
      modelOverride: { provider: 'anthropic', model: 'claude-3-sonnet' },
    });

    const [, options] = fetchMock.mock.calls[0];
    const headers = (options as RequestInit).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-xxx');
    expect(headers).not.toHaveProperty('authorization');
  });

  it('throws a configuration error when no credentials are provided', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(
      generateResponse({ goal: 'Goal', plan: 'Plan', modelOverride: { provider: 'anthropic', model: 'claude-3' } }),
    ).rejects.toThrow('Anthropic configuration error');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('surfaces rate-limit errors with retry hints', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-xxx';

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ error: { message: 'Too many requests' } }),
        {
          status: 429,
          headers: {
            'content-type': 'application/json',
            'retry-after': '15',
            'anthropic-request-id': 'req_123',
          },
        },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      generateResponse({ goal: 'Goal', plan: 'Plan', modelOverride: { provider: 'anthropic', model: 'claude-3' } }),
    ).rejects.toThrow(/rate limit exceeded.*Retry after 15 seconds/i);

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.system).toContain('You are a meta-mentor');
  });
});
