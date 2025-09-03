# Changelog

## v2.5.0 — 2025-09-03
- Transport: migrate STDIO → Streamable HTTP (`POST /mcp`, `GET /mcp` → 405).
- Constitution tools: `update_constitution`, `reset_constitution`, `check_constitution` (session-scoped, in-memory, logged).
- CPI surfaced: banner + concise metrics; links to ResearchGate, CPI GitHub, and Zenodo (MURST).

## v2.2.0 - 2025-07-22
- CPI architecture enables adaptive interrupts to mitigate Reasoning Lock-In
- History continuity across sessions
- Multi-provider support for Gemini, OpenAI and OpenRouter
- Optional vibe_learn logging for privacy-conscious deployments
- Repository restructured with Vitest unit tests and CI workflow

## v1.1.0 - 2024-06-10
- Initial feedback loop and Docker setup
