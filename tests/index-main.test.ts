import { afterEach, describe, expect, it, vi } from 'vitest';

describe('main entrypoint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes the HTTP server when stdio transport is disabled', async () => {
    vi.resetModules();
    const module = await import('../src/index.js');
    const serverMock = { connect: vi.fn() } as unknown as import('@modelcontextprotocol/sdk/server/index.js').Server;
    const startMock = vi
      .fn<Parameters<typeof module.startHttpServer>, ReturnType<typeof module.startHttpServer>>()
      .mockResolvedValue({ app: {} as any, listener: { close: vi.fn() } as any, transport: {} as any, close: vi.fn() });

    await module.main({
      createServer: async () => serverMock,
      startHttp: startMock,
    });

    expect(startMock).toHaveBeenCalledWith(expect.objectContaining({ server: serverMock, attachSignalHandlers: true, logger: console }));
  });
});
