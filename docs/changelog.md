# Changelog

## v2.9.0 — 2026-07-25 (Security & Model Refresh)

**Note:** The project remains in maintenance mode: no active feature development, but maintenance patches like this one are still published.

### Models & Providers
- Added `src/utils/models.ts`, a single registry that defines the supported providers, their default model and the suggested model IDs. The LLM dispatcher and the `vibe_check` tool schema now read from it instead of repeating hard-coded strings, and the docs are written against it.
- `DEFAULT_MODEL` is now scoped to `DEFAULT_LLM_PROVIDER`. Previously a call that overrode only the provider (`modelOverride: { provider: 'anthropic' }`) still sent the configured `DEFAULT_MODEL` — typically a Gemini model ID — to that provider and got a 404. It now falls through to the target provider's registry default.
- **Gemini:** default is now `gemini-3.6-flash` (was `gemini-2.5-pro`), served natively from Google AI Studio. The retry model is `gemini-3.5-flash-lite` (was `gemini-2.5-flash`). `gemini-3.5-flash` and the 2.5 models remain selectable.
- **Anthropic:** default is now `claude-sonnet-5` (was `claude-3-5-sonnet-20241022`). `claude-opus-5`, `claude-fable-5` and `claude-haiku-4-5-20251001` are listed as supported.
- **OpenAI:** default is now `gpt-5.6-terra` (was `o4-mini`), with `gpt-5.6-sol` and `gpt-5.6-luna` listed as supported.
- **OpenRouter** still requires an explicit fully-qualified slug; the registry carries examples only.
- Migrated from the retired `@google/generative-ai` package (deprecated Nov 2025, unmaintained) to the unified `@google/genai` SDK. The dispatcher now calls `ai.models.generateContent({ model, contents })` and reads `response.text`.
- The Gemini fallback no longer retries when the failing model *is* the fallback — that case previously issued a duplicate doomed request.
- A blocked or empty Gemini response is now treated as a failure. `@google/genai` exposes `text` as a getter that returns `undefined` — rather than throwing, as the retired package did — when a candidate is safety-blocked, has no parts, or is thought-only. Left as-is that returned an empty string, so neither the model retry nor the static-question fallback fired and the agent received a blank vibe check.

### Security
- **CORS no longer defaults to `*`.** Unset `CORS_ORIGIN` now means "loopback origins only, any port", which is what local MCP clients use. A comma-separated allowlist or `*` restores broader access. Credentialed CORS is never enabled.
- **DNS-rebinding protection.** The `Host` header is validated against `localhost` / `127.0.0.1` / `::1` by default; `MCP_ALLOWED_HOSTS` accepts a list or `*`. Rebinding makes an attacker's page same-origin, so CORS alone does not stop it.
- **Explicit, validated body cap.** JSON bodies are limited to 100kb, configurable via `MCP_MAX_BODY_SIZE`. Unparseable values fall back to the default instead of being passed to body-parser, which silently disables enforcement for limits it cannot parse (GHSA on `body-parser`).
- The `Host` check runs ahead of the CORS middleware, so a disallowed host cannot get a preflight answered — `cors` terminates allowed-origin preflights itself without calling the next handler.
- `MCP_ALLOWED_HOSTS` entries are normalised the same way incoming `Host` headers are, so an entry written with a port (`mcp.internal:8080` — the literal value an operator reads off a request) matches instead of rejecting every request. `Host` values are also shape-checked, so `localhost:80@evil.example` no longer reduces to `localhost`.
- Body-parser rejections and unknown routes now return JSON-RPC errors rather than Express's HTML pages, with the correct codes (`-32700` for malformed JSON, `-32600` for oversized bodies, `-32601` for unknown routes). The underlying error message and stack are logged server-side; the client only sees the sanitised message. `X-Powered-By` is disabled.
- `MCP_MAX_BODY_SIZE` accepts the `tb`/`pb` units the `bytes` parser understands, and rejects `0`, which would have 413'd every request.
- `scripts/security-check.cjs` no longer flags method calls such as `regex.exec(...)` as process execution; real `child_process` use is still caught (verified with a probe file).
- Adopts the intent of community PR #99 with a working implementation: `cors({ origin: 'http://localhost:*' })` as proposed is not a pattern the `cors` package expands, so it would have matched only that literal string, and `express.json({ limit: '100kb' })` restates body-parser's existing default.
- `npm audit` is clean (0 advisories, was 10 including 6 high): axios 1.13.5 → 1.18.1, MCP SDK 1.26 → 1.29 (pulls hono 4.12.32, form-data 4.0.6, fast-uri 3.1.4), vitest/coverage-v8 3.2.6 → 4.1.10 (clears the brace-expansion, minimatch, glob, test-exclude, postcss and esbuild advisories in the test toolchain).
- Added an `overrides` entry pinning `@hono/node-server` to `^2.0.11`. The MCP SDK declares `^1.19.9`, a range that cannot reach the version fixing GHSA-frvp-7c67-39w9; the override is covered by the HTTP integration tests and should be removed once the SDK widens its range.
- `SECURITY.md` refreshed: the tool inventory said "two safe tools" when there are five, and the new HTTP controls are documented.

### Maintenance
- Dropped the unused `body-parser` direct dependency (Express 5 bundles its own), bumped the OpenAI SDK to 6.x, and corrected `@types/express` to v5 to match the installed Express.
- `smithery.yaml`: declared Node `>=20` to match `package.json` (was `>=18`), passed `MCP_ALLOWED_HOSTS` so hosted deployments keep working under the new default, and added the missing `anthropic` tag.
- `scripts/docker-setup.sh` now emits `MCP_ALLOWED_HOSTS` in the generated `docker-compose.yml`. The compose service publishes no ports, so it is reached by service name — which the new loopback-only default would otherwise reject. Documented in [docker-automation.md](./docker-automation.md).
- README: fixed the quickstart's HTTP endpoints, which pointed at `/health` and `/rpc` instead of the real `/healthz` and `/mcp`.
- New tests: `tests/http-security.test.ts` plus HTTP integration coverage for host rejection, allowlisted hosts, oversized bodies and header hygiene.

### Upgrade notes
- If you run the HTTP transport on a non-loopback hostname (Docker, reverse proxy, hosted), set `MCP_ALLOWED_HOSTS` to that hostname or `*`, otherwise requests are rejected with HTTP 403.
- If a browser client on a non-loopback origin calls the server, set `CORS_ORIGIN` to that origin.
- No changes to the stdio transport, the tool contracts, or the response formats.

## v2.8.1 — 2026-06-12 (Maintenance Release)

**Note:** The project remains in maintenance mode: no active feature development, but maintenance patches like this one are still published.

### Release & Packaging
- Publish the v2.8.0 fixes to npm: v2.8.0 was tagged in `package.json` only — no `v2.8.0` git tag was pushed, so the npm publish workflow never ran and the registry stayed at 2.7.6. v2.8.1 ships everything from v2.8.0 plus the items below.
- Add `.github/workflows/create-release.yml` — GitHub Releases are now created automatically (with auto-generated notes) when a `v*` tag is pushed.

### Bug Fixes
- `smithery.yaml` pointed npm installs at the wrong package scope (`@mseep/vibe-check-mcp`); corrected to `@pv-bhat/vibe-check-mcp`.
- `server.json` now declares the real provider environment variables (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, all optional/secret) instead of a `YOUR_API_KEY` placeholder.
- `scripts/sync-version.mjs` now also syncs `server.json`, `CITATION.cff`, and `smithery.yaml` (previously stranded at 2.5.1, 2.7.3, and 2.5.0 respectively), and no longer rewrites the most recent `CHANGELOG.md` release heading (which could mislabel an older release) — it warns when the new version's entry is missing instead.

### Security
- **vitest / @vitest/coverage-v8** 3.2.4 → 3.2.6 (devDependencies) — clears GHSA-5xrq-8626-4rwp (arbitrary file read/execute via the Vitest UI server). Production dependency tree was already clean; `npm audit` is now fully clean again.

## v2.8.0 — 2026-03-30 (Final Maintenance Release)

**Note:** This is the final maintenance release. The project is no longer actively maintained but remains available for use under the MIT license. Community forks and contributions are welcome.

### Bug Fixes
- Fix `check_constitution` returning invalid MCP content type (`type: "json"` → `type: "text"`) — closes #84
- Fix HTTP Accept header normalization to work with MCP SDK >=1.26 (Hono adapter reads `rawHeaders`)
- Remove unused `sampling` capability (no longer in SDK types)

### Security
- **axios** 1.12.2 → 1.13.5 — fixes DoS via `__proto__` key in mergeConfig
- **@modelcontextprotocol/sdk** 1.16.0 → 1.26.0 — fixes cross-client response data leakage (GHSA-345p-7cg4-v4c7)
- **diff** 5.2.0 → 8.0.3 — fixes DoS and ReDOS vulnerabilities in `parsePatch`
- **express** 5.1.0 → 5.2.1 — fixes CVE-2024-51999
- **brace-expansion**, **minimatch**, **picomatch**, **qs**, **rollup**, **yaml** — all patched via audit fix
- Resolved all 14 npm audit vulnerabilities → **0 vulnerabilities**

### Maintenance
- Remove `@types/diff` dev dependency (TypeScript definitions now bundled in diff 8.x)
- Update `httpTransportWrapper` to target inner `_webStandardTransport` for SDK 1.26 compatibility
- Update JSON-RPC compat tests for new SDK transport architecture

## v2.5.0 — 2025-09-03
- Transport: migrate STDIO → Streamable HTTP (`POST /mcp`, `GET /mcp` → 405).
- Constitution tools: `update_constitution`, `reset_constitution`, `check_constitution` (session-scoped, in-memory, logged).
- CPI surfaced: banner + concise metrics; links to ResearchGate, CPI GitHub, and Zenodo (MURST).

## v2.2.0 - 2025-07-22
- CPI architecture enables adaptive interrupts to mitigate Reasoning Lock-In
- History continuity across sessions
- Multi-provider support for Gemini, OpenAI and OpenRouter
- Optional vibe_learn logging for privacy-conscious deployments
- Repository restructured with Vitest unit tests and CI workflow

## v1.1.0 - 2024-06-10
- Initial feedback loop and Docker setup
