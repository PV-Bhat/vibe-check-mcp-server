# 🧠 Vibe Check MCP

![Logo](https://github.com/PV-Bhat/vibe-check-mcp-server/blob/main/Attachments/vibelogo.png)

[![Version](https://img.shields.io/badge/version-0.2.0-blue)](https://github.com/PV-Bhat/vibe-check-mcp-server)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![smithery badge](https://smithery.ai/badge/@PV-Bhat/vibe-check-mcp-server)](https://smithery.ai/server/@PV-Bhat/vibe-check-mcp-server)

## Why Vibe Check?

Modern AI coding agents are powerful but fragile. Once they lock onto a plan they
rarely stop to question whether it still makes sense. Vibe Check provides that
missing moment of reflection. It interrupts faulty reasoning, highlights
assumptions and records lessons learned so your agent becomes more resilient over
time.

**TL;DR**: Vibe Check adds a metacognitive feedback loop to keep AI coding agents
aligned and on track.

## Key Features

- **vibe_check** – pattern interrupt tool using the `learnlm-2.0-flash-experimental`
  model (with automatic fallback to `gemini-2.5-flash` and `gemini-2.0-flash`)
  for up to a 1M token context window.
- **vibe_learn** – records mistakes, preferences and successes to build a rich
  learning history that feeds back into `vibe_check`.
- **Large context awareness** – the full learning log is summarized and included
  in prompts so the model can spot recurring patterns and reinforce successful
  approaches.

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

Create a `.env` file with your API key:

```bash
GEMINI_API_KEY=your_gemini_api_key
```

Start the server:

```bash
npm start
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
- [Philosophy](./docs/philosophy.md)
- [Case Studies](./docs/case-studies.md)

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](LICENSE)
