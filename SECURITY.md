# Security Policy

VibeCheck MCP is designed as a lightweight oversight layer for AI coding agents. While it does not execute code on behalf of the agent, it processes user prompts and sends them to third‑party LLM APIs. This document outlines our approach to keeping that process secure.

## Supported Versions
Only the latest release receives security updates. Please upgrade regularly to stay protected.

## Threat Model
- **Prompt injection**: malicious text could attempt to alter the meta-mentor instructions. VibeCheck uses a fixed system prompt and validates required fields to mitigate this.
- **Tool misuse**: the server exposes five read/advise tools (`vibe_check`, `vibe_learn`, `update_constitution`, `reset_constitution`, `check_constitution`). None of them execute commands or read arbitrary files; `vibe_learn` writes only to its own log at `~/.vibe-check/vibe-log.json`.
- **Data leakage**: requests are forwarded to the configured LLM provider. Avoid sending sensitive data if using hosted APIs. The optional `vibe_learn` log can be disabled via environment variables.
- **Browser-reachable local server**: in HTTP mode the server is a local listener that a web page could try to reach. Two mitigations are on by default (see below).
- **Impersonation**: run VibeCheck only from this official repository or the published npm package. Verify the source before deployment.

## HTTP transport hardening

These defaults apply to `--http` mode only; the stdio transport is not network-reachable.

| Control | Default | Override |
|---|---|---|
| CORS origin allowlist | loopback origins only (`localhost`, `127.0.0.1`, `::1`, any port) | `CORS_ORIGIN` — comma-separated list, or `*` to allow all |
| DNS-rebinding protection | `Host` must be `localhost`, `127.0.0.1` or `::1` | `MCP_ALLOWED_HOSTS` — comma-separated list, or `*` to disable |
| Request body cap | 100kb of JSON | `MCP_MAX_BODY_SIZE` — a size string such as `250kb` |

Credentialed CORS is never enabled, so a permissive `CORS_ORIGIN` cannot be combined with cookie or `Authorization` replay from a browser. An unparseable `MCP_MAX_BODY_SIZE` is ignored in favour of the default rather than passed through, because body-parser silently disables size enforcement for limits it cannot parse.

If you serve VibeCheck on a non-loopback hostname (a container, a reverse proxy, a hosted deployment), set `MCP_ALLOWED_HOSTS` to that hostname. Do not expose the server to untrusted networks without an authenticating proxy in front of it — VibeCheck itself performs no authentication.

## Reporting a Vulnerability
If you discover a security issue, please open a private GitHub issue or email the maintainer listed in `package.json`. We will acknowledge your report within 48 hours and aim to provide a fix promptly.

## Continuous Security
A custom security scan runs in CI on every pull request (`npm run security-check`). It fails the build on any high or critical advisory in the production dependency tree and searches the source tree for dangerous patterns. Dependabot is enabled for npm updates.

### Dependency overrides

`package.json` pins `@hono/node-server` to `^2.0.11` via `overrides`. The MCP SDK still declares `^1.19.9`, a range that cannot reach the version fixing GHSA-frvp-7c67-39w9 (path traversal in `serve-static`). The override is verified by the HTTP integration tests and can be dropped once the SDK widens its range.

**Scope:** npm ignores `overrides` declared by a dependency, so this pin applies to installs *of this repository* — it does not follow the published package. If you install `@pv-bhat/vibe-check-mcp` as a dependency and want the same pin, add it to your own `overrides` (npm), `resolutions` (yarn) or `pnpm.overrides`. The vulnerable code path is `serve-static`, which this server never mounts.
