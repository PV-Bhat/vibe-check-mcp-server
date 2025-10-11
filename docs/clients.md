# MCP Client Integration Notes

This document supplements the CLI installers documented in the [README](../README.md). Each section outlines discovery paths, schema nuances, and post-installation tips.

## Claude Desktop

- **Config path**: `claude_desktop_config.json` (auto-detected per platform).
- **Schema**: `mcpServers` map keyed by server ID.
- **Default transport**: stdio (`npx -y @pv-bhat/vibe-check-mcp start --stdio`).
- **Restart**: Quit and relaunch Claude Desktop after installation.

```jsonc
{
  "mcpServers": {
    "vibe-check-mcp": {
      "command": "npx",
      "args": ["-y", "@pv-bhat/vibe-check-mcp", "start", "--stdio"],
      "env": {},
      "managedBy": "vibe-check-mcp-cli"
    }
  }
}
```

Docs: [Claude Desktop MCP](https://docs.anthropic.com/en/docs/claude-desktop/model-context-protocol)

## Cursor

- **Config path**: `~/.cursor/mcp.json` (override with `--config` if needed).
- **Schema**: Claude-style `mcpServers` map.
- **Fallback**: When the config file is missing, the CLI prints a JSON snippet suitable for Cursor's MCP settings UI.

```jsonc
{
  "mcpServers": {
    "vibe-check-mcp": {
      "command": "npx",
      "args": ["-y", "@pv-bhat/vibe-check-mcp", "start", "--stdio"],
      "env": {},
      "managedBy": "vibe-check-mcp-cli"
    }
  }
}
```

Reference: [Cursor community thread on MCP](https://forum.cursor.so/t/mcp-support/1487)

## Windsurf (Cascade)

- **Config paths**: legacy `~/.codeium/windsurf/mcp_config.json`, new builds `~/.codeium/mcp_config.json`.
- **Transports**: stdio by default; HTTP uses `serverUrl`.
- **Restart**: Close and reopen Windsurf to reload MCP servers.

```jsonc
// stdio
{
  "mcpServers": {
    "vibe-check-mcp": {
      "command": "npx",
      "args": ["-y", "@pv-bhat/vibe-check-mcp", "start", "--stdio"],
      "env": {},
      "managedBy": "vibe-check-mcp-cli"
    }
  }
}

// http
{
  "mcpServers": {
    "vibe-check-mcp": {
      "serverUrl": "http://127.0.0.1:2091",
      "managedBy": "vibe-check-mcp-cli"
    }
  }
}
```

Docs: [Codeium Windsurf MCP guide](https://docs.codeium.com/windsurf/model-context-protocol)

## Visual Studio Code

- **Workspace config**: `.vscode/mcp.json` (profiles use the VS Code user data dir).
- **Transports**: stdio (`transport: "stdio"`) or HTTP (`url` + `transport: "http"`).
- **CLI tips**: Provide `--config` to target a workspace file. Without it, the CLI prints a JSON snippet plus a `vscode:mcp/install?...` quick-install link.
- **Dev helpers**: `--dev-watch` sets `dev.watch=true`; `--dev-debug <value>` populates `dev.debug`.

```jsonc
{
  "servers": {
    "vibe-check-mcp": {
      "command": "npx",
      "args": ["-y", "@pv-bhat/vibe-check-mcp", "start", "--stdio"],
      "env": {},
      "transport": "stdio",
      "managedBy": "vibe-check-mcp-cli"
    }
  }
}
```

Docs:
- [VS Code MCP announcement](https://code.visualstudio.com/updates/v1_102#_model-context-protocol)
- [VS Code MCP quickstart](https://code.visualstudio.com/docs/copilot/mcp)

## JetBrains (future)

JetBrains AI Assistant already consumes Claude-style MCP configs over stdio. Import from Claude or point it at the same command once JetBrains exposes MCP import hooks publicly.

Docs: [JetBrains AI Assistant MCP](https://blog.jetbrains.com/ai/2024/08/model-context-protocol/)
