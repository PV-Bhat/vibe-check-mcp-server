# Changelog

See [docs/changelog.md](docs/changelog.md) for the full release history.

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
