# Release & versioning workflow

## Source of truth

- `version.json` stores the canonical semantic version for the project. Update this file first when preparing a release.
- `scripts/sync-version.mjs` reads `version.json` and synchronizes `package.json`, `package-lock.json`, `README.md`, `CITATION.cff`, and the primary `CHANGELOG.md` headers.

## Syncing metadata

1. Update `version.json` with the next version.
2. Run `npm run sync-version` to apply the version across metadata, README badges, and the changelog title.
3. Inspect the diff to ensure the package manifests and documentation updated as expected.

> Tip: `npm run sync-version` will validate the version string and exit non-zero if the value is not compliant `major.minor.patch` semver.

## Changelog updates

- Summarize notable changes under the "## Unreleased" section in [`CHANGELOG.md`](../CHANGELOG.md), then rename it to match the release tag (for example `## v2.8.0 - 2025-11-04`).
- Mirror the highlights in [`docs/changelog.md`](./changelog.md) if you maintain the curated public history.

## npm workflows

- `npm run prepublishOnly` automatically runs `npm run build` before `npm publish`, ensuring the transpiled output is current.
- `npm publish` should only be executed after the sync step so the registry receives the correct version number.
- Use `npm pack` or `npm publish --dry-run` to verify the release contents locally when iterating on the workflow.

## GitHub Release Automation

- When a git tag matching `v*.*.*` is pushed, the `create-release.yml` workflow automatically creates a GitHub release.
- The release notes are extracted from `CHANGELOG.md` for that version.
- The `release.yml` workflow automatically publishes to npm.

## Checklist

- [ ] Update `version.json`
- [ ] `npm run sync-version`
- [ ] Update changelog entries (`CHANGELOG.md`, optional `docs/changelog.md`)
- [ ] `npm test` (or relevant verification)
- [ ] Commit all changes
- [ ] Create and push a git tag (e.g., `git tag v2.x.x && git push origin v2.x.x`)
- [ ] GitHub Actions will automatically create the release and publish to npm
