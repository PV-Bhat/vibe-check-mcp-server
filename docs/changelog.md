# Changelog

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
