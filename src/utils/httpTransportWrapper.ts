import { AsyncLocalStorage } from 'node:async_hooks';

import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export interface RequestScopeStore {
  forceJson?: boolean;
}

const WRAPPED_SYMBOL: unique symbol = Symbol.for('vibe-check.requestScopedTransport');

export function createRequestScopedTransport(
  transport: StreamableHTTPServerTransport,
  scope: AsyncLocalStorage<RequestScopeStore>
): StreamableHTTPServerTransport {
  const existing = (transport as any)[WRAPPED_SYMBOL];
  if (existing) {
    return transport;
  }

  let storedValue = (transport as any)._enableJsonResponse ?? false;

  Object.defineProperty(transport, '_enableJsonResponse', {
    configurable: true,
    enumerable: false,
    get() {
      const store = scope.getStore();
      if (store?.forceJson) {
        return true;
      }
      return storedValue;
    },
    set(value: boolean) {
      storedValue = value;
    }
  });

  (transport as any)[WRAPPED_SYMBOL] = true;
  return transport;
}
