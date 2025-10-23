# Agent Quickstart

Vibe Check MCP is a lightweight oversight layer for AI agents. It exposes two tools:

- **vibe_check** – prompts you with clarifying questions to prevent tunnel vision.
- **vibe_learn** – optional logging of mistakes and successes for later review.

The server supports Gemini, OpenAI, Anthropic, and OpenRouter LLMs. History is maintained across requests when a `sessionId` is provided.

## Setup

1. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
2. Supply the following environment variables as needed:
   - `GEMINI_API_KEY`
   - `OPENAI_API_KEY`
   - `OPENROUTER_API_KEY`
   - `ANTHROPIC_API_KEY` *(official Anthropic deployments)*
   - `ANTHROPIC_AUTH_TOKEN` *(Anthropic-compatible proxies)*
   - `ANTHROPIC_BASE_URL` *(optional; defaults to https://api.anthropic.com)*
   - `ANTHROPIC_VERSION` *(optional; defaults to 2023-06-01)*
   - `DEFAULT_LLM_PROVIDER` (gemini | openai | openrouter | anthropic)
   - `DEFAULT_MODEL` (e.g., gemini-2.5-pro)
3. Start the server:
   ```bash
   npm start
   ```

## Testing

Run unit tests with `npm test`. Example request generators are provided:

- `alt-test-gemini.js`
- `alt-test-openai.js`
- `alt-test.js` (OpenRouter)

Each script writes a `request.json` file that you can pipe to the server:

```bash
node build/index.js < request.json
```

## Integration Tips

Call `vibe_check` regularly with your goal, plan and current progress. Use `vibe_learn` whenever you want to record a resolved issue. Full API details are in `docs/technical-reference.md`.
