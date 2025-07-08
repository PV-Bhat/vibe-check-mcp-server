# 🧠 Vibe Check MCP

![Logo](https://github.com/PV-Bhat/vibe-check-mcp-server/blob/main/Attachments/vibelogov2.png)

[![Version](https://img.shields.io/badge/version-0.2.0-blue)](https://github.com/PV-Bhat/vibe-check-mcp-server)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![smithery badge](https://smithery.ai/badge/@PV-Bhat/vibe-check-mcp-server)](https://smithery.ai/server/@PV-Bhat/vibe-check-mcp-server)

## What is Vibe Check?

Vibe Check is a metacognitive layer that keeps AI coding agents honest. It
pauses the agent at key moments, challenges shaky assumptions and records what
worked (or failed) so the next run is smarter. Think of it as the agent's inner
rubber duck—always nudging the conversation back to the user's actual needs.

**TL;DR**: Vibe Check makes AI coding agents more resilient and aligned by
enforcing moments of reflection.

## The Problem: Pattern Inertia

LLMs often follow the first solution they imagine. Once that pattern takes hold
they elaborate on it even if it drifts from the original goal. Without an
external nudge the agent seldom questions its direction, leading to
misalignment, overengineering and wasted cycles.

## Key Features

- **vibe_check** – pattern interrupt tool using the `learnlm-2.0-flash-experimental`
  model (with automatic fallback to `gemini-2.5-flash` and `gemini-2.0-flash`)
  for up to a 1M token context window.
- **vibe_learn** – records mistakes, preferences and successes to build a rich
  learning history that feeds back into `vibe_check`.
- **Large context awareness** – the full learning log is summarized and included
  in prompts so the model can spot recurring patterns and reinforce successful
  approaches.

These two tools feed each other. `vibe_check` interrupts questionable plans,
`vibe_learn` captures the lesson, and the growing log informs the next
`vibe_check` call via the model's 1M token context window.

```
[vibe_check] <----> [vibe_learn]
      ^                |
      |________________|
```

The more your agent works, the more context Vibe Check has to keep it on the
right path.

## Installation

```bash
# Clone and install
git clone https://github.com/PV-Bhat/vibe-check-mcp-server.git
cd vibe-check-mcp-server
npm install
npm run build
```

This project targets Node **20+**. If you see a TypeScript error about a
duplicate `require` declaration when building with Node 20.19.3, ensure your
dependencies are up to date (`npm install`) or use the Docker setup below which
handles the build automatically.

Create a `.env` file with your API key:

```bash
GEMINI_API_KEY=your_gemini_api_key
```

Start the server:

```bash
npm start
```

### Docker

The repository includes a helper script for one-command setup. It builds the
image, saves your `GEMINI_API_KEY` and configures the container to start
automatically whenever you log in:

```bash
bash scripts/docker-setup.sh
```

This script:

- Creates `~/vibe-check-mcp` for persistent data
- Builds the Docker image and sets up `docker-compose.yml`
- Prompts for your API key and writes `~/vibe-check-mcp/.env`
- Installs a systemd service (Linux) or LaunchAgent (macOS) so the container
  starts at login
- Generates `vibe-check-tcp-wrapper.sh` which proxies Cursor IDE to the server

After running it, open Cursor IDE → **Settings** → **MCP** and add a new server
of type **Command** pointing to:

```bash
~/vibe-check-mcp/vibe-check-tcp-wrapper.sh
```

See [Automatic Docker Setup](./docs/docker-automation.md) for full details.

If you prefer to run the commands manually:

```bash
docker build -t vibe-check-mcp .
docker run -e GEMINI_API_KEY=your_gemini_api_key -p 3000:3000 vibe-check-mcp
```

### Integrating with Claude Desktop

Add to `claude_desktop_config.json`:

```json
"vibe-check": {
  "command": "node",
  "args": ["/path/to/vibe-check-mcp/build/index.js"],
  "env": { "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY" }
}
```

## Agent Prompting Essentials

In your agent's system prompt make it clear that `vibe_check` is a mandatory
pattern interrupt. Always pass the full user request and specify the current
phase (`planning`, `implementation`, or `review`). After correcting a mistake,
log it with `vibe_learn` so the system can recognize it next time.

Example snippet:

```
As an autonomous agent you will:
1. Call vibe_check after planning and before major actions.
2. Provide the full user request and your current plan.
3. Record resolved issues with vibe_learn so future checks get smarter.
```

## When to Use Each Tool

| Tool | Purpose |
|------|---------|
| 🛑 **vibe_check** | Challenge assumptions and prevent tunnel vision |
| 🔄 **vibe_learn** | Capture mistakes, preferences and successes |

## Documentation

- [Agent Prompting Strategies](./docs/agent-prompting.md)
- [Advanced Integration](./docs/advanced-integration.md)
- [Technical Reference](./docs/technical-reference.md)
- [Automatic Docker Setup](./docs/docker-automation.md)
- [Philosophy](./docs/philosophy.md)
- [Case Studies](./docs/case-studies.md)

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](LICENSE)
