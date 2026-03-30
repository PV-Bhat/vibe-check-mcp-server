# Changelog

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
