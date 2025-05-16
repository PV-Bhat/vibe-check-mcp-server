# 🧠 Vibe Check MCP

<img src="https://github.com/PV-Bhat/vibe-check-mcp-server/blob/main/Attachments/vibelogo.png" alt="Logo" width="150" height="150">

[![Version](https://img.shields.io/badge/version-0.2.0-blue)](https://github.com/PV-Bhat/vibe-check-mcp-server)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Pattern Status](https://img.shields.io/badge/pattern-interrupted-red)](https://github.com/PV-Bhat/vibe-check-mcp-server)
[![smithery badge](https://smithery.ai/badge/@PV-Bhat/vibe-check-mcp-server)](https://smithery.ai/server/@PV-Bhat/vibe-check-mcp-server)
[![Vibe Check MCP Server](https://img.shields.io/badge/vibecheck%20-mcp.so-blue)](https://mcp.so/server/vibe-check-mcp-server/PV-Bhat)
[![Verified on MseeP](https://mseep.ai/badge.svg)](https://mseep.ai/app/6dd1b68e-85aa-40c8-83fb-f746653aca4f)

Also find Vibecheck on: [mcpservers.org](https://github.com/wong2/awesome-mcp-servers?tab=readme-ov-file#community-servers), [Glama.ai](https://glama.ai/mcp/servers/@PV-Bhat/vibe-check-mcp-server/), [mcp.so](https://mcp.so/server/vibe-check-mcp-server/PV-Bhat)


_Your AI's inner rubber duck when it can't rubber duck itself._

## What is Vibe Check?

In the **"vibe coding"** era, AI agents now have incredible capabilities, but the question has now moved:

from 
> "Can my AI agent really do this **complex task**?" 

to
 
> "Can my AI agent understand that I want to write a **simple program**, not an _infrastructure for a multi-billion dollar tech company_?"

It provides the essential "Hold up... this ain't it" moment that AI agents don't currently have: a built in self-correcting oversight layer. It's the definitive Vibe Coder's sanity check MCP server: 

- Prevent cascading errors in AI workflows by implementing strategic pattern interrupts. 
- Uses tool call "Vibe Check" with LearnLM 1.5 Pro (Gemini API), fine-tuned for pedagogy and metacognition to enhance complex workflow strategy, and prevents tunnel vision errors.
- Implements "Vibe Distill" to encourage plan simplification, prevent over-engineering solutions, and minimize contextual drift in agents.
- Self-improving feedback loops: Agents can log mistakes into "Vibe Learn" to improve semantic recall and help the oversight AI target patterns over time.

**TLDR; Implement an agent fine-tuned to stop your agent and make it reconsider before it confidently implements something wrong.**

## The Problem: Pattern Inertia

In the vibe coding movement, we're all using LLMs to generate, refactor, and debug our code. But these models have a critical flaw: once they start down a reasoning path, they'll keep going even when the path is clearly wrong.

```
You: "Parse this CSV file"

AI: "First, let's implement a custom lexer/parser combination that can handle arbitrary 
     CSV dialects with an extensible architecture for future file formats..."

You: *stares at 200 lines of code when you just needed to read 10 rows*
```

This **pattern inertia** leads to:

- 🔄 **Tunnel vision**: Your agent gets stuck in one approach, unable to see alternatives
- 📈 **Scope creep**: Simple tasks gradually evolve into enterprise-scale solutions
- 🔌 **Overengineering**: Adding layers of abstraction to problems that don't need them
- ❓ **Misalignment**: Solving an adjacent but different problem than the one you asked for

## Features: Metacognitive Oversight Tools

Vibe Check adds a metacognitive layer to your agent workflows with three integrated tools:

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

**Meta-thinking anchor point** that recalibrates complex workflows:

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

### Vibe Check in Action

**Before Vibe Check:**

![before](https://github.com/PV-Bhat/vibe-check-mcp-server/blob/main/Attachments/VCC1.png)

_Claude assumes the meaning of MCP despite ambiguity, leading to all subsequent steps having this wrong assumption_

**After Vibe Check:**

![after](https://github.com/PV-Bhat/vibe-check-mcp-server/blob/main/Attachments/VCC2.png)

_Vibe Check MCP is called, and points out the ambiguity, which forces Claude to acknowledge this lack of information and proactively address it_

## Installation & Setup

### Installing via Smithery

To install vibe-check-mcp-server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@PV-Bhat/vibe-check-mcp-server):

```bash
npx -y @smithery/cli install @PV-Bhat/vibe-check-mcp-server --client claude
```

### Manual Installation via npm (Recommended)

```bash
# Clone the repo
git clone https://github.com/PV-Bhat/vibe-check-mcp-server.git
cd vibe-check-mcp-server

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm run start
```

## Integration with Claude

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

## Environment Configuration

Create a `.env` file in the project root:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

## Agent Prompting Guide

For effective pattern interrupts, include these instructions in your system prompt:

```
As an autonomous agent, you will:

1. Treat vibe_check as a critical pattern interrupt mechanism
2. ALWAYS include the complete user request with each call
3. Specify the current phase (planning/implementation/review)
4. Use vibe_distill as a recalibration anchor when complexity increases
5. Build the feedback loop with vibe_learn to record resolved issues
```

## When to Use Each Tool

| Tool | When to Use |
|------|-------------|
| 🛑 **vibe_check** | When your agent starts explaining blockchain fundamentals for a todo app |
| ⚓ **vibe_distill** | When your agent's plan has more nested bullet points than your entire tech spec |
| 🔄 **vibe_learn** | After you've manually steered your agent back from the complexity abyss |

## API Reference

See the [Technical Reference](./docs/technical-reference.md) for complete API documentation.

## Architecture

<details>
<summary><b>The Metacognitive Architecture (Click to Expand)</b></summary>

Vibe Check implements a dual-layer metacognitive architecture based on recursive oversight principles. Key insights:

1. **Pattern Inertia Resistance**: LLM agents naturally demonstrate a momentum-like property in their reasoning paths, requiring external intervention to redirect.

2. **Phase-Resonant Interrupts**: Metacognitive questioning must align with the agent's current phase (planning/implementation/review) to achieve maximum corrective impact.

3. **Authority Structure Integration**: Agents must be explicitly prompted to treat external metacognitive feedback as high-priority interrupts rather than optional suggestions.

4. **Anchor Compression Mechanisms**: Complex reasoning flows must be distilled into minimal anchor chains to serve as effective recalibration points.

5. **Recursive Feedback Loops**: All observed missteps must be stored and leveraged to build longitudinal failure models that improve interrupt efficacy.

For more details on the underlying design principles, see [Philosophy](./docs/philosophy.md).
</details>

## Vibe Check in Action (Continued)

![VC1](https://github.com/PV-Bhat/vibe-check-mcp-server/blob/main/Attachments/VC1.png)

---

![V2](https://github.com/PV-Bhat/vibe-check-mcp-server/blob/main/Attachments/vc2.png)

---


![V3](https://github.com/PV-Bhat/vibe-check-mcp-server/blob/main/Attachments/vc3.png)

---


![V4](https://github.com/PV-Bhat/vibe-check-mcp-server/blob/main/Attachments/vc4.png)


## Verifications

<img src="https://mseep.net/pr/pv-bhat-vibe-check-mcp-server-badge.png" alt="Logo" width="100" height="100">

## Documentation

| Document | Description |
|----------|-------------|
| [Agent Prompting Strategies](./docs/agent-prompting.md) | Detailed techniques for agent integration |
| [Advanced Integration](./docs/advanced-integration.md) | Feedback chaining, confidence levels, and more |
| [Technical Reference](./docs/technical-reference.md) | Complete API documentation |
| [Philosophy](./docs/philosophy.md) | The deeper AI alignment principles behind Vibe Check |
| [Case Studies](./docs/case-studies.md) | Real-world examples of Vibe Check in action |

## Contributing

We welcome contributions to Vibe Check! Whether it's bug fixes, feature additions, or just improving documentation, check out our [Contributing Guidelines](./CONTRIBUTING.md) to get started.

## License

[MIT](LICENSE)
