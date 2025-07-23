# Security Policy

VibeCheck MCP is designed as a lightweight oversight layer for AI coding agents. While it does not execute code on behalf of the agent, it processes user prompts and sends them to third‑party LLM APIs. This document outlines our approach to keeping that process secure.

## Supported Versions
Only the latest release receives security updates. Please upgrade regularly to stay protected.

## Threat Model
- **Prompt injection**: malicious text could attempt to alter the meta-mentor instructions. VibeCheck uses a fixed system prompt and validates required fields to mitigate this.
- **Tool misuse**: the server exposes only two safe tools (`vibe_check` and `vibe_learn`). No command execution or file access is performed.
- **Data leakage**: requests are forwarded to the configured LLM provider. Avoid sending sensitive data if using hosted APIs. The optional `vibe_learn` log can be disabled via environment variables.
- **Impersonation**: run VibeCheck only from this official repository or the published npm package. Verify the source before deployment.

## Reporting a Vulnerability
If you discover a security issue, please open a private GitHub issue or email the maintainer listed in `package.json`. We will acknowledge your report within 48 hours and aim to provide a fix promptly.

## Continuous Security
A custom security scan runs in CI on every pull request. It checks dependencies for known vulnerabilities and searches the source tree for dangerous patterns. The workflow fails if any issue is detected.

