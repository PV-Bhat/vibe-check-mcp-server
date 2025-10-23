import crypto from 'node:crypto';

export interface JsonRpcRequestLike {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

const STABLE_ID_PREFIX = 'compat-';

function computeStableHash(request: JsonRpcRequestLike): string {
  const params = request.params ?? {};
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ method: request.method, params }))
    .digest('hex')
    .slice(0, 12);
}

function generateNonce(): string {
  const nonceValue = parseInt(crypto.randomBytes(3).toString('hex'), 16);
  const base36 = nonceValue.toString(36);
  return base36.padStart(4, '0').slice(-6);
}

export function formatCompatId(stableHash: string, nonce: string = generateNonce()): string {
  return `${STABLE_ID_PREFIX}${stableHash}-${nonce}`;
}

function computeStableId(request: JsonRpcRequestLike): string {
  const stableHash = computeStableHash(request);
  return formatCompatId(stableHash);
}

export interface ShimResult {
  applied: boolean;
  id?: string;
}

export function applyJsonRpcCompatibility(request: JsonRpcRequestLike | undefined | null): ShimResult {
  if (!request || typeof request !== 'object') {
    return { applied: false };
  }

  if ((request as any).jsonrpc !== '2.0') {
    return { applied: false };
  }

  if ((request as any).method !== 'tools/call') {
    return { applied: false };
  }

  if ((request as any).id !== undefined && (request as any).id !== null) {
    return { applied: false };
  }

  const id = computeStableId(request);
  (request as any).id = id;
  return { applied: true, id };
}

export interface TransportLike {
  onmessage?: (message: any, extra?: any) => void;
}

export function wrapTransportForCompatibility<T extends TransportLike>(transport: T): T {
  const originalOnMessage = transport.onmessage;
  let wrappedHandler: typeof transport.onmessage;

  const wrapHandler = (handler?: typeof transport.onmessage) => {
    if (!handler) {
      wrappedHandler = undefined;
      return;
    }

    wrappedHandler = function (this: unknown, message: JsonRpcRequestLike, extra?: any) {
      applyJsonRpcCompatibility(message);
      return handler.call(this ?? transport, message, extra);
    };
  };

  Object.defineProperty(transport, 'onmessage', {
    configurable: true,
    enumerable: true,
    get() {
      return wrappedHandler;
    },
    set(handler) {
      if (handler === wrappedHandler && handler !== undefined) {
        return;
      }
      wrapHandler(handler);
    },
  });

  if (originalOnMessage) {
    transport.onmessage = originalOnMessage;
  }

  return transport;
}
