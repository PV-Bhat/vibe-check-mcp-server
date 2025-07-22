# 🧠 Vibe Check MCP v2.1: Adaptive Meta-Mentor for AI Agents

![Logo](https://github.com/PV-Bhat/vibe-check-mcp-server/blob/main/Attachments/vibelogov2.png)

[![Version](https://img.shields.io/badge/version-2.1.0-blue)](https://github.com/PV-Bhat/vibe-check-mcp-server)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![smithery badge](https://smithery.ai/badge/@PV-Bhat/vibe-check-mcp-server)](https://smithery.ai/server/@PV-Bhat/vibe-check-mcp-server)

Vibe Check MCP provides a meta-mentor layer that helps AI agents stay on track. The server asks clarifying questions, surfaces assumptions and captures lessons learned. Agents keep their autonomy, but gain a helpful voice that nudges them toward simpler, goal‑focused solutions.

## What's New in v2.1
- New meta-mentor prompt with a humble, methodology-focused tone
- History continuity enabled by default so each call builds on prior advice
- Flexible multi-provider LLM support (Gemini, OpenAI, OpenRouter)
- `vibe_learn` remains optional for capturing mistakes and successes
- Repository restructured with Vitest unit tests and coverage

## Installation
```bash
npm install
npm run build
```
Create a `.env` file with at least one API key:
```bash
GEMINI_API_KEY=your_key
# or OPENAI_API_KEY / OPENROUTER_API_KEY
```
Start the server:
```bash
npm start
```

## Prompting Basics
Use `vibe_check` as a collaborative debugger. Pass the goal and current plan along with the full user request. The server will reply with questions you can use to refine your approach. History from the same `sessionId` is automatically included.

## Documentation
- [Technical Reference](./docs/technical-reference.md)
- [Agent Prompting Guide](./docs/agent-prompting.md)
- [Advanced Integration](./docs/advanced-integration.md)
- [Philosophy](./docs/philosophy.md)
- [Changelog](./docs/changelog.md)

Licensed under the [MIT License](LICENSE).
