# Agent Quickstart

Vibe Check MCP is a lightweight oversight layer for AI agents. It exposes two tools:

- **vibe_check** – prompts you with clarifying questions to prevent tunnel vision.
- **vibe_learn** – optional logging of mistakes and successes for later review.

The server supports Gemini, OpenAI, Anthropic, OpenRouter, and OAICompatible LLMs. History is maintained across requests when a `sessionId` is provided.

## Provider Selection Guide

### OpenAI vs OAICompatible: What's the Difference?

**OpenAI Provider** (`openai`)
- Use for official OpenAI API access
- Requires: `OPENAI_API_KEY`
- Connects to `https://api.openai.com`
- Best for: Direct OpenAI API usage

**OAICompatible Provider** (`oai-compatible`)
- Use for any OpenAI-compatible API endpoint
- Requires: `OAICOMPATIBLE_API_KEY` and `OAICOMPATIBLE_BASE_URL`
- Connects to your custom endpoint
- Best for: Local models, proxy services, alternative providers

### When to Use OAICompatible

The OAICompatible provider is perfect for:
- **Local Models**: Ollama, LM Studio, or other local inference servers
- **Proxy Services**: Services that provide OpenAI-compatible endpoints
- **Alternative Providers**: Companies offering OpenAI-compatible APIs (e.g., iflow API)
- **Development**: Testing against mock endpoints or staging environments

### Quick Setup Examples

```bash
# For local Ollama with OpenAI compatibility
export OAICOMPATIBLE_API_KEY="not-needed"
export OAICOMPATIBLE_BASE_URL="http://localhost:11434/v1"

# For iflow API (100% OpenAI compatible)
export OAICOMPATIBLE_API_KEY="sk-your-api-key"
export OAICOMPATIBLE_BASE_URL="https://apis.iflow.cn/v1"

# For any custom OpenAI-compatible endpoint
export OAICOMPATIBLE_API_KEY="your-api-key"
export OAICOMPATIBLE_BASE_URL="https://your-provider.com/v1"
```

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

### Core Provider Keys
- `GEMINI_API_KEY` - For Google Gemini models
- `OPENAI_API_KEY` - For official OpenAI API access
- `OPENROUTER_API_KEY` - For OpenRouter model access
- `ANTHROPIC_API_KEY` - For official Anthropic deployments

### OAICompatible Provider (Custom OpenAI-Compatible Endpoints)
- `OAICOMPATIBLE_API_KEY` *(required for OAICompatible provider)*
  - API key for your OpenAI-compatible endpoint
  - Can be any string for local models that don't require authentication
- `OAICOMPATIBLE_BASE_URL` *(required for OAICompatible provider)*
  - Base URL for your OpenAI-compatible API endpoint
  - Must be a valid HTTP/HTTPS URL starting with `http://` or `https://`
  - Must end with `/v1` for most OpenAI-compatible APIs
  - Examples:
    - `http://localhost:11434/v1` (Ollama)
    - `http://localhost:8080/v1` (LM Studio)
    - `https://apis.iflow.cn/v1` (iflow API)
- `OAICOMPATIBLE_MODEL` *(optional for OAICompatible provider)*
  - Default model name to use when no model is explicitly specified
  - If not set, defaults to `glm-4.6`
  - Examples:
    - `llama-2-7b-chat`
    - `mistral-7b-instruct`
    - `gpt-3.5-turbo`
- `OAICOMPATIBLE_TIMEOUT` *(optional for OAICompatible provider)*
  - Request timeout in milliseconds
  - If not set, uses the OpenAI client's default timeout

### Anthropic Advanced Options
- `ANTHROPIC_AUTH_TOKEN` *(for Anthropic-compatible proxies)*
- `ANTHROPIC_BASE_URL` *(optional; defaults to https://api.anthropic.com)*
- `ANTHROPIC_VERSION` *(optional; defaults to 2023-06-01)*

### Default Configuration
- `DEFAULT_LLM_PROVIDER` (gemini | openai | openrouter | anthropic | oai-compatible)
- `DEFAULT_MODEL` (e.g., gemini-2.5-pro, gpt-4, glm-4.6)

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

Run unit tests with `npm test`. Example request generators are provided:

- `alt-test-gemini.js`
- `alt-test-openai.js`
- `alt-test.js` (OpenRouter)
- `alt-test-oai-compatible.js` (OAICompatible)

Each script writes a `request.json` file that you can pipe to the server:

```bash
node build/index.js < request.json
```

## Troubleshooting OAICompatible Provider

### Common Issues and Solutions

**Issue: "OAICompatible API key missing" error**
- Solution: Ensure both `OAICOMPATIBLE_API_KEY` and `OAICOMPATIBLE_BASE_URL` are set
- For local models without authentication, you can set `OAICOMPATIBLE_API_KEY` to any value (e.g., "not-needed")

**Issue: Connection timeout or unreachable endpoint**
- Solution: Verify your `OAICOMPATIBLE_BASE_URL` is accessible
- Test with curl: `curl $OAICOMPATIBLE_BASE_URL/models`
- Ensure the URL includes the proper protocol (http/https) and port

**Issue: "Model not found" error**
- Solution: Check which models your endpoint supports
- Use standard OpenAI model names (gpt-3.5-turbo, gpt-4, etc.) for most compatible endpoints
- Some providers may require specific model names (check their documentation)

**Issue: Authentication failures**
- Solution: Verify your API key is correct for the specific provider
- Some endpoints may require different key formats or additional headers

### Testing Your OAICompatible Setup

Use the provided test script to verify your configuration:

```bash
# Set your environment variables
export OAICOMPATIBLE_API_KEY="your-key"
export OAICOMPATIBLE_BASE_URL="https://your-endpoint.com/v1"

# Generate and run the test
node alt-test-oai-compatible.js
node build/index.js < request.json
```

## Integration Tips

Call `vibe_check` regularly with your goal, plan and current progress. Use `vibe_learn` whenever you want to record a resolved issue. Full API details are in `docs/technical-reference.md`.

For detailed client setup and advanced configuration, see:
- [Client Integration Guide](docs/clients.md)
- [Technical Reference](docs/technical-reference.md)
- [Agent Prompting Strategies](docs/agent-prompting.md)
