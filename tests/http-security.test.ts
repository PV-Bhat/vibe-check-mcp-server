import { describe, it, expect } from 'vitest';
import {
  resolveCorsOptions,
  resolveAllowedHosts,
  resolveBodyLimit,
  isHostAllowed,
  hostnameFromHeader,
  JSON_BODY_LIMIT,
} from '../src/utils/httpSecurity.js';

/** Drive the `origin` callback of a CorsOptions object. */
function allows(options: ReturnType<typeof resolveCorsOptions>, origin: string | undefined): boolean {
  const originOption = options.origin;
  if (typeof originOption === 'string') return originOption === '*' || originOption === origin;
  if (typeof originOption !== 'function') throw new Error('expected an origin resolver');
  let result: boolean | undefined;
  originOption(origin as string, (_err, allowed) => {
    result = allowed as boolean;
  });
  return result === true;
}

describe('resolveCorsOptions', () => {
  it('allows loopback origins on any port by default', () => {
    const options = resolveCorsOptions('');
    expect(allows(options, 'http://localhost:5173')).toBe(true);
    expect(allows(options, 'http://127.0.0.1:2091')).toBe(true);
    expect(allows(options, 'https://localhost')).toBe(true);
  });

  it('rejects non-loopback origins by default', () => {
    const options = resolveCorsOptions('');
    expect(allows(options, 'https://evil.example')).toBe(false);
    // Hostnames that merely embed "localhost" must not slip through.
    expect(allows(options, 'https://localhost.evil.example')).toBe(false);
    expect(allows(options, 'https://notlocalhost')).toBe(false);
  });

  it('permits requests with no Origin header (non-browser clients)', () => {
    expect(allows(resolveCorsOptions(''), undefined)).toBe(true);
  });

  it('honours an explicit comma-separated allowlist', () => {
    const options = resolveCorsOptions('https://a.example, https://b.example');
    expect(allows(options, 'https://a.example')).toBe(true);
    expect(allows(options, 'https://b.example')).toBe(true);
    expect(allows(options, 'https://c.example')).toBe(false);
    // An explicit allowlist replaces the loopback default rather than extending it.
    expect(allows(options, 'http://localhost:3000')).toBe(false);
  });

  it('supports opting back into the wildcard, never with credentials', () => {
    const options = resolveCorsOptions('*');
    expect(options.origin).toBe('*');
    expect(options.credentials).toBe(false);
  });

  it('never enables credentials for the loopback default', () => {
    expect(resolveCorsOptions('').credentials).toBe(false);
  });
});

describe('resolveAllowedHosts / isHostAllowed', () => {
  it('defaults to loopback hosts', () => {
    const hosts = resolveAllowedHosts('');
    expect(isHostAllowed('localhost:2091', hosts)).toBe(true);
    expect(isHostAllowed('127.0.0.1:3000', hosts)).toBe(true);
    expect(isHostAllowed('[::1]:3000', hosts)).toBe(true);
    expect(isHostAllowed('attacker.example', hosts)).toBe(false);
  });

  it('rejects a rebinding host that resolves to loopback', () => {
    const hosts = resolveAllowedHosts('');
    expect(isHostAllowed('127.0.0.1.nip.io:3000', hosts)).toBe(false);
  });

  it('rejects a missing Host header rather than defaulting to allow', () => {
    expect(isHostAllowed(undefined, resolveAllowedHosts(''))).toBe(false);
  });

  it('accepts an explicit host allowlist', () => {
    const hosts = resolveAllowedHosts('mcp.internal, vibe.example');
    expect(isHostAllowed('mcp.internal:8080', hosts)).toBe(true);
    expect(isHostAllowed('VIBE.EXAMPLE', hosts)).toBe(true);
    expect(isHostAllowed('localhost:3000', hosts)).toBe(false);
  });

  it('matches allowlist entries that include a port', () => {
    // Operators naturally copy the literal Host value they see, port and all.
    const hosts = resolveAllowedHosts('mcp.internal:8080');
    expect(isHostAllowed('mcp.internal:8080', hosts)).toBe(true);
    expect(isHostAllowed('mcp.internal', hosts)).toBe(true);
    expect(isHostAllowed('other.internal:8080', hosts)).toBe(false);
  });

  it('accepts a bare IPv6 allowlist entry as well as the bracketed form', () => {
    expect(isHostAllowed('[::1]:3000', resolveAllowedHosts('::1'))).toBe(true);
    expect(isHostAllowed('[::1]:3000', resolveAllowedHosts('[::1]'))).toBe(true);
  });

  it('rejects Host values that only look like an allowlisted host', () => {
    const hosts = resolveAllowedHosts('');
    // lastIndexOf(':') alone would reduce this to "localhost".
    expect(isHostAllowed('localhost:80@evil.example', hosts)).toBe(false);
    expect(isHostAllowed('localhost evil.example', hosts)).toBe(false);
    expect(isHostAllowed('localhost.', hosts)).toBe(false);
  });

  it('disables checking entirely on "*"', () => {
    const hosts = resolveAllowedHosts('*');
    expect(hosts).toBeNull();
    expect(isHostAllowed('anything.example', hosts)).toBe(true);
    expect(isHostAllowed(undefined, hosts)).toBe(true);
  });
});

describe('hostnameFromHeader', () => {
  it('strips ports and normalises case', () => {
    expect(hostnameFromHeader('Example.COM:8080')).toBe('example.com');
    expect(hostnameFromHeader('example.com')).toBe('example.com');
  });

  it('keeps IPv6 literals intact', () => {
    expect(hostnameFromHeader('[::1]:3000')).toBe('[::1]');
    expect(hostnameFromHeader('[::1]')).toBe('[::1]');
  });

  it('returns an empty string for values that are not host-shaped', () => {
    expect(hostnameFromHeader('localhost:80@evil.example')).toBe('');
    expect(hostnameFromHeader('local host')).toBe('');
    expect(hostnameFromHeader('')).toBe('');
  });
});

describe('resolveBodyLimit', () => {
  it('defaults when unset', () => {
    expect(resolveBodyLimit(undefined)).toBe(JSON_BODY_LIMIT);
    expect(resolveBodyLimit('  ')).toBe(JSON_BODY_LIMIT);
  });

  it('accepts byte counts and size strings', () => {
    expect(resolveBodyLimit('250kb')).toBe('250kb');
    expect(resolveBodyLimit('1mb')).toBe('1mb');
    expect(resolveBodyLimit('524288')).toBe('524288');
  });

  it('accepts the larger units the bytes parser understands', () => {
    expect(resolveBodyLimit('1tb')).toBe('1tb');
    expect(resolveBodyLimit('1pb')).toBe('1pb');
  });

  it('falls back on unparseable values instead of disabling enforcement', () => {
    // body-parser silently drops size enforcement for limits it cannot parse.
    expect(resolveBodyLimit('unlimited')).toBe(JSON_BODY_LIMIT);
    expect(resolveBodyLimit('-1')).toBe(JSON_BODY_LIMIT);
    expect(resolveBodyLimit('0x100')).toBe(JSON_BODY_LIMIT);
  });

  it('rejects a zero limit, which would 413 every request', () => {
    expect(resolveBodyLimit('0')).toBe(JSON_BODY_LIMIT);
    expect(resolveBodyLimit('0kb')).toBe(JSON_BODY_LIMIT);
  });
});
