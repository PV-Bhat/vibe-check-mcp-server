# Vibe Check MCP

[![Generated-Image-March-22-2025-3-18-PM-png.jpg](https://i.postimg.cc/76MPvY3q/Generated-Image-March-22-2025-3-18-PM-png.jpg)](https://postimg.cc/CB5pk0r2)

[![Version](https://img.shields.io/badge/version-0.2.0-blue)](https://github.com/yourusername/vibe-check-mcp)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> The metacognitive pattern interrupt system for AI-assisted development.

## Overview

Vibe Check provides the essential "Hold on... this ain't it" intervention that doesn't naturally exist in LLM agents. By creating strategic pattern interrupts, it prevents cascading errors caused by tunnel vision, over-engineering, and misalignment in AI coding workflows.

## Problem

In the vibe coding era, AI agents suffer from pattern inertia—once they start down a path, they continue despite warning signs. This leads to:

- 🔄 **Tunnel vision**: Focusing too narrowly on one approach
- 📈 **Scope creep**: Adding unnecessary complexity or features
- ❓ **Misalignment**: Solving a different problem than requested
- 🔁 **Recurring errors**: Repeating the same mistakes across projects

## Solution

Vibe Check MCP creates a complete metacognitive layer with three integrated tools:

### 🛑 vibe_check

**Pattern interrupt mechanism** that breaks tunnel vision with metacognitive questioning:

```javascript
vibe_check({
  "phase": "planning",           // planning, implementation, or review
  "userRequest": "...",          // FULL original user request 
  "plan": "...",                 // Current plan or thinking
  "confidence": 0.7              // Optional: 0-1 confidence level
})
```

### ⚓ vibe_distill

**Meta-thinking anchor point** that recalibrates complex workflows with essential elements:

```javascript
vibe_distill({
  "plan": "...",                 // Detailed plan to simplify
  "userRequest": "..."           // FULL original user request
})
```

### 🔄 vibe_learn

**Self-improving feedback loop** that builds pattern recognition over time:

```javascript
vibe_learn({
  "mistake": "...",              // One-sentence description of mistake
  "category": "...",             // From standard categories
  "solution": "..."              // How it was corrected
})
```

## Installation

### Installing via Smithery

To install vibe-check-mcp-server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@PV-Bhat/vibe-check-mcp-server):

```bash
npx -y @smithery/cli install @PV-Bhat/vibe-check-mcp-server --client claude
```

### Manual Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm run start
```

## Integration

Add to your `claude_desktop_config.json`:

```json
"vibe-check": {
  "command": "node",
  "args": [
    "/path/to/vibe-check-mcp/build/index.js"
  ],
  "env": {
    "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY"
  }
}
```

## Agent Prompting

For effective pattern interrupts, include this in your system prompt:

```
As an autonomous agent, you will:

1. Treat vibe_check as a critical pattern interrupt mechanism
2. ALWAYS include the complete user request with each call
3. Specify the current phase (planning/implementation/review)
4. Use vibe_distill as a recalibration anchor when complexity increases
5. Build the feedback loop with vibe_learn to record resolved issues
```

## When to Use

- 🛑 **vibe_check**: After planning, before implementation, or when complexity increases
- ⚓ **vibe_distill**: When plans become overly complex or need recalibration
- 🔄 **vibe_learn**: After correcting errors to feed the self-improving loop

## Key Insights

Our research revealed five critical insights for effective metacognitive oversight:

1. **Pattern Inertia**: LLM agents naturally resist course correction without explicit prompting
2. **Phase Awareness**: Feedback must match the agent's current development phase
3. **Authority Structure**: Agents must view feedback as high-priority user proxies
4. **Recalibration Points**: Meta-thinking anchors prevent drift in large workflows
5. **Self-Improvement**: Error patterns must feed back to create learning over time

## Documentation

| Document | Description |
|----------|-------------|
| [Agent Prompting Strategies](./docs/agent-prompting.md) | Detailed techniques for agent integration |
| [Advanced Integration](./docs/advanced-integration.md) | Feedback chaining, confidence levels, and more |
| [Technical Reference](./docs/technical-reference.md) | Complete API documentation |

## License

[MIT](LICENSE)
