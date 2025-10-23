import crypto from 'node:crypto';

export interface JsonRpcRequestLike {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

const STABLE_ID_PREFIX = 'compat-';

function computeStableId(request: JsonRpcRequestLike): string {
  const params = request.params ?? {};
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ method: request.method, params }))
    .digest('hex')
    .slice(0, 12);
  return `${STABLE_ID_PREFIX}${hash}`;
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
  const existingOnMessage = transport.onmessage;
  transport.onmessage = (message: JsonRpcRequestLike, extra?: any) => {
    applyJsonRpcCompatibility(message);
    return existingOnMessage?.(message, extra);
  };
  return transport;
}
