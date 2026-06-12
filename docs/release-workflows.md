# Release & versioning workflow

## Source of truth

- `version.json` stores the canonical semantic version for the project. Update this file first when preparing a release.
- `scripts/sync-version.mjs` reads `version.json` and synchronizes `package.json`, `package-lock.json`, `server.json`, `CITATION.cff`, `smithery.yaml`, and the README badges/headings.

## Syncing metadata

1. Update `version.json` with the next version.
2. Run `npm run sync-version` to apply the version across package manifests, registry metadata, and README badges.
3. Inspect the diff to ensure the package manifests and documentation updated as expected.

> Tip: `npm run sync-version` will validate the version string and exit non-zero if the value is not compliant `major.minor.patch` semver.

## Changelog updates

- Add a `## vX.Y.Z - YYYY-MM-DD` entry at the top of [`CHANGELOG.md`](../CHANGELOG.md) **before** running `npm run sync-version`; the script warns if the entry for the new version is missing (it intentionally never rewrites existing release headings).
- Mirror the highlights in [`docs/changelog.md`](./changelog.md), the curated public history.

## Publishing — push a tag

Publishing is driven by git tags, not by running `npm publish` locally:

- Pushing a `v*` tag (for example `v2.8.1`) triggers `.github/workflows/release.yml`, which builds, runs the test suite and CLI smoke checks, verifies the package contents, publishes to npm, and smoke-tests the published version via `npx`.
- The same tag push triggers `.github/workflows/create-release.yml`, which creates the GitHub Release with auto-generated notes.

```bash
git tag v2.8.1
git push origin v2.8.1
```

> **Important:** merging a version bump to `main` does **not** publish anything. v2.8.0 was never released to npm because the tag was never pushed — don't skip this step.

- Use `npm pack` or `npm publish --dry-run` to verify the release contents locally when iterating on the workflow.

## Checklist

- [ ] Update `version.json`
- [ ] Add the `## vX.Y.Z - date` entry to `CHANGELOG.md` (and `docs/changelog.md`)
- [ ] `npm run sync-version`
- [ ] `npm test` and `npm run security-check`
- [ ] Merge to `main`
- [ ] `git tag vX.Y.Z && git push origin vX.Y.Z` — this publishes to npm and creates the GitHub Release
