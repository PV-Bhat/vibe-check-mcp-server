# Agent Quickstart

Vibe Check MCP is a lightweight oversight layer for AI agents. It exposes two tools:

- **vibe_check** – prompts you with clarifying questions to prevent tunnel vision.
- **vibe_learn** – optional logging of mistakes and successes for later review.

The server supports Gemini, OpenAI, Anthropic, and OpenRouter LLMs. History is maintained across requests when a `sessionId` is provided.

## Quickstart (npx)

Run the server directly from npm without a local installation. Requires Node **>=20**. Choose a transport:

### Option 1 – MCP client over STDIO

```bash
npx -y @pv-bhat/vibe-check-mcp start --stdio
```

- Launch from an MCP-aware client (Claude Desktop, Cursor, Windsurf, etc.).
- `[MCP] stdio transport connected` indicates the process is waiting for the client.
- Add this block to your client config so it spawns the command:

```json
{
  "mcpServers": {
    "vibe-check-mcp": {
      "command": "npx",
      "args": ["-y", "@pv-bhat/vibe-check-mcp", "start", "--stdio"]
    }
  }
}
```

### Option 2 – Manual HTTP inspection

```bash
npx -y @pv-bhat/vibe-check-mcp start --http --port 2091
```

- `curl http://127.0.0.1:2091/health` to confirm the service is live.
- Send JSON-RPC requests to `http://127.0.0.1:2091/rpc`.

## Client Installation

Use the CLI installer for automatic configuration:

```bash
# Claude Desktop
npx @pv-bhat/vibe-check-mcp install --client claude

# Cursor
npx @pv-bhat/vibe-check-mcp install --client cursor

# Windsurf
npx @pv-bhat/vibe-check-mcp install --client windsurf

# VS Code
npx @pv-bhat/vibe-check-mcp install --client vscode
```

Run `npx @pv-bhat/vibe-check-mcp --list-clients` to see all supported integrations.

## Environment Variables

Supply the following environment variables as needed:

- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `ANTHROPIC_API_KEY` *(official Anthropic deployments)*
- `ANTHROPIC_AUTH_TOKEN` *(Anthropic-compatible proxies)*
- `ANTHROPIC_BASE_URL` *(optional; defaults to https://api.anthropic.com)*
- `ANTHROPIC_VERSION` *(optional; defaults to 2023-06-01)*
- `DEFAULT_LLM_PROVIDER` (gemini | openai | openrouter | anthropic)
- `DEFAULT_MODEL` (e.g., gemini-2.5-pro)

## Local Development

For local development:

1. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
2. Start the server:
   ```bash
   npm start
   ```

## Testing

Run unit tests with `npm test`. The JSON-RPC compatibility shim mitigates missing `id` fields on `tools/call` requests so the standard SDK client and Windsurf work without extra tooling, but compliant clients should continue to send their own identifiers. Example request generators remain available if you want canned payloads for manual testing:

- `alt-test-gemini.js`
- `alt-test-openai.js`
- `alt-test.js` (OpenRouter)

Each script writes a `request.json` file that you can pipe to the server:

```bash
node build/index.js < request.json
```

## Integration Tips

Call `vibe_check` regularly with your goal, plan and current progress. Use `vibe_learn` whenever you want to record a resolved issue. Full API details are in `docs/technical-reference.md`.

For detailed client setup and advanced configuration, see:
- [Client Integration Guide](clients.md)
- [Technical Reference](technical-reference.md)
- [Agent Prompting Strategies](agent-prompting.md)
