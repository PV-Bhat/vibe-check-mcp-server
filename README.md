# 🧠 Vibe Check MCP v2.1

<img width="500" height="300" alt="vibecheckv2 1" src="https://github.com/user-attachments/assets/98c55b95-8f3c-4106-b917-20ceaf292f63" />

## The Most Widely-Deployed Feedback Layer in the MCP Ecosystem

> ~10k+ downloads on PulseMCP and counting.
> Over 1k monthly tool calls via Smithery.
> Listed on 12+ orchestration platforms.
> Security rating 4.3 on MSEEP.ai.

[![Version](https://img.shields.io/badge/version-2.1-blue)](https://github.com/PV-Bhat/vibe-check-mcp-server)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![smithery badge](https://smithery.ai/badge/@PV-Bhat/vibe-check-mcp-server)](https://smithery.ai/server/@PV-Bhat/vibe-check-mcp-server)
[![Verified on MseeP](https://mseep.ai/badge.svg)](https://mseep.ai/app/a2954e62-a3f8-45b8-9a03-33add8b92599)

## What is Vibe Check?

Vibe Check acts as a supportive meta-mentor for AI coding agents. It
interrupts tunnel vision, asks clarifying questions, improves workflow efficiency and records what worked so
the next run is smarter. Think of it as an adaptive debugging partner that acts as a built-in oversight layer.

**TL;DR**: Vibe Check keeps agents on track through short reflective pauses, preventing agents getting stuck in 
loops of thinking (RLI) and improving overall workflow efficiency.

## The Problem: Pattern Inertia

LLMs often follow the first solution they imagine. Once that pattern takes hold
they elaborate on it even if it drifts from the original goal. Without an
external nudge the agent seldom questions its direction, leading to
misalignment, overengineering and wasted cycles.

## Key Features

- **vibe_check** – Adaptive meta-mentor step that questions plans and highlights unstated assumptions.
- **vibe_learn** – Optional log of mistakes and solutions to gradually improve over time.
- **History continuity** – Prior feedback is automatically provided for a sense of memory.
- **Multi-LLM flexibility** – Choose Gemini, OpenAI or OpenRouter by overriding two fields.

## What's New in v2.1

- Meta-mentor prompt rewritten for methodology-focused guidance.
- History continuity enabled by default for richer conversations.
- Multi-provider support (Gemini, OpenAI, OpenRouter) with simple overrides.
- `vibe_learn` made optional for privacy-conscious deployments.
- Repository restructured with Vitest unit tests and CI workflow.
- Smithery tool listing fixed via lazy loading.



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

Create a `.env` file with the API keys you plan to use:

```bash
# Gemini (default)
GEMINI_API_KEY=your_gemini_api_key
# Optional providers
OPENAI_API_KEY=your_openai_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
# Optional overrides
DEFAULT_LLM_PROVIDER=gemini
DEFAULT_MODEL=gemini-2.5-pro
```

Start the server:

```bash
npm start
```

See [docs/TESTING.md](./docs/TESTING.md) for instructions on how to run tests.

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

In your agent's system prompt, make it clear that `vibe_check` is a mandatory tool for reflection. Always pass the full user request and other relevant context. After correcting a mistake, you can optionally log it with `vibe_learn` to build a history for future analysis.

Example snippet:

```
As an autonomous agent you will:
1. Call vibe_check after planning and before major actions.
2. Provide the full user request and your current plan.
3. Optionally, record resolved issues with vibe_learn.
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
- [Changelog](./docs/changelog.md)

## To-do List

- [ ] Additional examples for OpenRouter models
- [ ] Repomix access to pass repositories to VC
- [ ] Agents.md addendum to improve plug-and-play integration

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## 🔗 Find **VibeCheck MCP** on:

* 🌐 [MSEEP](https://mseep.ai/app/pv-bhat-vibe-check-mcp-server)
* 📡 [MCP Servers](https://mcpservers.org/servers/PV-Bhat/vibe-check-mcp-server)
* 🧠 [MCP.so](https://mcp.so/server/vibe-check-mcp-server/PV-Bhat)
* 🛠️ [Creati.ai](https://creati.ai/mcp/vibe-check-mcp-server/)
* 💡 [Pulse MCP](https://www.pulsemcp.com/servers/pv-bhat-vibe-check)
* 📘 [Playbooks.com](https://playbooks.com/mcp/pv-bhat-vibe-check)
* 🧰 [MCPHub.tools](https://mcphub.tools/detail/PV-Bhat/vibe-check-mcp-server)
* 📇 [MCP Directory](https://mcpdirectory.ai/mcpserver/2419/)
* 🧙 [MagicSlides](https://www.magicslides.app/mcps/pv-bhat-vibe-check)
* 🗃️ [AIAgentsList](https://aiagentslist.com/mcp-servers/vibe-check-mcp-server)


## License

[MIT](LICENSE)
