import type { CorsOptions } from 'cors';

/**
 * Hardening helpers for the HTTP transport.
 *
 * Vibe Check's HTTP mode is normally a loopback service that a local agent
 * client talks to. Two browser-reachable attack paths matter there:
 *
 *  - **Cross-origin reads.** A wildcard CORS policy lets any page a user has
 *    open script the local MCP server. The default here is a loopback-only
 *    origin allowlist; wildcard is still available but must be asked for.
 *  - **DNS rebinding.** An attacker-controlled name that resolves to 127.0.0.1
 *    makes the request same-origin, so CORS never applies. Validating the
 *    `Host` header is the standard mitigation.
 *
 * Both are configurable so remote/containerised deployments are not broken:
 * `CORS_ORIGIN` and `MCP_ALLOWED_HOSTS` each accept a comma-separated list or
 * `*` to opt out.
 */

/** Default cap on JSON request bodies (also body-parser's built-in default). */
export const JSON_BODY_LIMIT = '100kb';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const WILDCARD = '*';

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Resolve the JSON body limit from `MCP_MAX_BODY_SIZE`.
 *
 * body-parser silently disables size enforcement when handed a limit it cannot
 * parse (GHSA advisory on `body-parser`), so an unusable value falls back to
 * the default rather than being passed through.
 */
export function resolveBodyLimit(raw: string | undefined = process.env.MCP_MAX_BODY_SIZE): string {
  const value = raw?.trim();
  if (!value) return JSON_BODY_LIMIT;
  // Accept a byte count or a `bytes`-style size string (e.g. 250kb, 1mb).
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb|pb)?$/i);
  // A zero limit would reject every request, which is a misconfiguration rather
  // than a policy — treat it the same as an unparseable value.
  if (match && Number(match[1]) > 0) {
    return value;
  }
  console.error(`[MCP] Ignoring invalid MCP_MAX_BODY_SIZE "${value}"; using ${JSON_BODY_LIMIT}.`);
  return JSON_BODY_LIMIT;
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    return LOOPBACK_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
}

/**
 * Build the CORS options for the MCP endpoint.
 *
 * - unset  → loopback origins only (any port), which is what local MCP clients use
 * - `*`    → legacy wildcard, opt-in only
 * - a list → exact-match allowlist of origins
 *
 * Requests without an `Origin` header (curl, native MCP clients, server-to-server)
 * are unaffected: CORS is a browser-enforced policy and those callers never send one.
 */
export function resolveCorsOptions(configured?: string): CorsOptions {
  const raw = configured ?? process.env.CORS_ORIGIN;
  const entries = splitList(raw);

  if (entries.includes(WILDCARD)) {
    // Never combined with credentials — that pairing is what makes wildcard unsafe.
    return { origin: WILDCARD, credentials: false };
  }

  const allowlist = new Set(entries);

  return {
    origin(origin, callback) {
      // No Origin header: not a browser cross-origin request, nothing to police.
      if (!origin) return callback(null, true);
      if (allowlist.size > 0) return callback(null, allowlist.has(origin));
      return callback(null, isLoopbackOrigin(origin));
    },
    credentials: false,
  };
}

/**
 * Resolve the `Host` allowlist used for DNS-rebinding protection.
 * Returns `null` when checking is disabled (`MCP_ALLOWED_HOSTS=*`).
 *
 * Entries are normalised the same way incoming `Host` headers are, so
 * `MCP_ALLOWED_HOSTS=mcp.internal:8080` — the literal value an operator reads off
 * a request — matches rather than silently locking the server down.
 */
export function resolveAllowedHosts(configured?: string): Set<string> | null {
  const raw = configured ?? process.env.MCP_ALLOWED_HOSTS;
  const entries = splitList(raw);
  if (entries.includes(WILDCARD)) return null;
  if (entries.length === 0) return new Set(LOOPBACK_HOSTNAMES);
  // A bare IPv6 literal (`::1`) is not a valid Host header but is a natural
  // thing to configure, so keep the raw entry when normalisation rejects it.
  return new Set(entries.map((entry) => hostnameFromHeader(entry) || entry.toLowerCase()));
}

/** `host[:port]`, where host is a DNS name/IPv4 or a bracketed IPv6 literal. */
const HOST_HEADER_SHAPE = /^(?:[a-z0-9._-]+|\[[0-9a-f:.]+\])(?::\d{1,5})?$/;

/**
 * Strip the port from a `Host` header value, handling bracketed IPv6 literals.
 * Values that are not shaped like a host return `''`, which never matches an
 * allowlist entry — `localhost:80@evil.example` must not reduce to `localhost`.
 */
export function hostnameFromHeader(hostHeader: string): string {
  const value = hostHeader.trim().toLowerCase();
  if (!HOST_HEADER_SHAPE.test(value)) return '';
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    return value.slice(0, end + 1);
  }
  const colon = value.lastIndexOf(':');
  return colon === -1 ? value : value.slice(0, colon);
}

export function isHostAllowed(hostHeader: string | undefined, allowedHosts: Set<string> | null): boolean {
  if (allowedHosts === null) return true;
  // A missing Host header cannot be a rebinding attack from a browser (HTTP/1.1
  // requires it), but reject it anyway rather than defaulting to allow.
  if (!hostHeader) return false;
  const hostname = hostnameFromHeader(hostHeader);
  if (!hostname) return false;
  if (allowedHosts.has(hostname)) return true;
  // `::1` and `[::1]` denote the same host depending on whether a port is present.
  if (hostname.startsWith('[') && allowedHosts.has(hostname.slice(1, -1))) return true;
  return false;
}
