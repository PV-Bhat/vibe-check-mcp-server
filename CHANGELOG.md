# Changelog

## Unreleased

- Introduce CLI scaffold and npx bin (no commands yet).

## v2.7.1 - 2025-10-11

- Added `install --client cursor|windsurf|vscode` adapters with managed-entry merges, atomic writes, and `.bak` rollbacks.
- Preserved Windsurf `serverUrl` HTTP entries and emitted VS Code workspace snippets plus `vscode:mcp/install` links when configs are absent.
- Updated documentation with consolidated provider-key guidance, transport selection, uninstall tips, and a dedicated [clients guide](docs/clients.md).
