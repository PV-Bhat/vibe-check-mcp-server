# Changelog

See [docs/changelog.md](docs/changelog.md) for the full release history.

## v2.9.0 - 2026-07-25

- **Models:** current defaults are `gemini-3.6-flash`, `claude-sonnet-5` and `gpt-5.6-terra`, with Opus 5 / Fable 5 and GPT-5.6 Sol / Luna also supported. Providers and model IDs now live in one registry (`src/utils/models.ts`).
- **Native Google AI Studio:** migrated from the retired `@google/generative-ai` package to the unified `@google/genai` SDK.
- **HTTP hardening:** CORS defaults to loopback origins instead of `*`, `Host` headers are validated to block DNS rebinding (`MCP_ALLOWED_HOSTS`), and the JSON body cap is explicit and validated (`MCP_MAX_BODY_SIZE`). Adopts the intent of PR #99 with a working implementation.
- **Security:** `npm audit` clean again — 10 advisories (6 high) resolved via axios 1.18.1, MCP SDK 1.29, vitest 4.x, and an `overrides` pin on `@hono/node-server` that the SDK's own range cannot reach.
- **Bug fixes:** a blocked/empty Gemini response no longer returns a blank vibe check (it now falls through to the retry and static questions); `DEFAULT_MODEL` is scoped to `DEFAULT_LLM_PROVIDER` so overriding only the provider no longer sends the wrong provider's model ID.
- **Maintenance:** dropped the unused `body-parser` dependency, OpenAI SDK 6.x, `@types/express` v5, `smithery.yaml` Node `>=20` + `MCP_ALLOWED_HOSTS`, README quickstart endpoints corrected, `SECURITY.md` refreshed.
- **Upgrade note:** serving HTTP on a non-loopback hostname now requires `MCP_ALLOWED_HOSTS`.

## v2.8.1 - 2026-06-12

- **Release pipeline:** v2.8.0 was never published to npm because no `v2.8.0` tag was pushed; v2.8.1 ships all v2.8.0 fixes to npm. GitHub Releases are now created automatically on tag push (`.github/workflows/create-release.yml`).
- **Version consistency:** `server.json` (was 2.5.1), `CITATION.cff` (was 2.7.3), and `smithery.yaml` (was 2.5.0) are now synced to the release version, and `scripts/sync-version.mjs` keeps them in sync going forward.
- **Registry metadata:** `smithery.yaml` pointed npm installs at the wrong package scope (`@mseep/vibe-check-mcp`); corrected to `@pv-bhat/vibe-check-mcp`. `server.json` now lists the real provider env vars (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`) instead of a `YOUR_API_KEY` placeholder.
- **Security (dev-only):** bumped `vitest` and `@vitest/coverage-v8` to ^3.2.6 — clears GHSA-5xrq-8626-4rwp (arbitrary file read/execute via the Vitest UI server). `npm audit` is fully clean again.
- `sync-version` no longer rewrites the most recent `CHANGELOG.md` release heading (which could mislabel an older release); it warns when the entry for the new version is missing instead.

## v2.8.0 - 2026-03-30

Maintenance release — security patches and bug fixes. See [docs/changelog.md](docs/changelog.md#v280--2026-03-30-final-maintenance-release) for details.

- Fixed `check_constitution` returning an invalid MCP content type (#84).
- Fixed HTTP Accept-header normalization for MCP SDK >=1.26 and removed the unused `sampling` capability.
- Resolved all 14 `npm audit` vulnerabilities: axios 1.13.5, @modelcontextprotocol/sdk 1.26.0 (cross-client data-leak fix), diff 8.0.3, express 5.2.1, plus transitive patches.

## v2.7.1 - 2025-10-11

- Added `install --client cursor|windsurf|vscode` adapters with managed-entry merges, atomic writes, and `.bak` rollbacks.
- Preserved Windsurf `serverUrl` HTTP entries and emitted VS Code workspace snippets plus `vscode:mcp/install` links when configs are absent.
- Updated documentation with consolidated provider-key guidance, transport selection, uninstall tips, and a dedicated [clients guide](docs/clients.md).
