# 🧠 Vibe Check MCP

[![Version](https://img.shields.io/badge/version-0.2.0-blue)](https://github.com/PV-Bhat/vibe-check-mcp-server)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Pattern Status](https://img.shields.io/badge/pattern-interrupted-red)](https://github.com/PV-Bhat/vibe-check-mcp-server)

> Your AI's inner rubber duck when it can't rubber duck itself.

## What is Vibe Check?

Vibe Check is a metacognitive pattern interrupt system for the vibe coding era. It provides the essential "Hold on... this ain't it" moment that your AI assistants can't generate for themselves.

It's not about making your AI smarter—it's about adding the layer of doubt, questioning, and course correction that humans naturally apply to their own thought processes.

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

## Real-World Impact

### Vibe Check in Action

![Vibe Check identifies ambiguity](https://raw.githubusercontent.com/PV-Bhat/vibe-check-mcp-server/main/docs/images/vibe-check-example1.png)

*Figure 1: Vibe Check identifies ambiguity in terminology (MCP) and prompts for clarification*

![Gemini search for MCPs](https://raw.githubusercontent.com/PV-Bhat/vibe-check-mcp-server/main/docs/images/vibe-check-example2.png)

*Figure 2: After Vibe Check feedback, proper search techniques are used to clarify ambiguous terms*

### Before & After

**Before Vibe Check:**
```
User: "Write a function to check if a string is a palindrome"

Agent: *generates 150 lines of code with custom character handling classes, 
        internationalization support, and a factory pattern*
```

**After Vibe Check:**
```
User: "Write a function to check if a string is a palindrome"

Agent: *starts complex approach*

Vibe Check: "Are we sure we need a class-based approach for this simple string operation?"

Agent: *course corrects*
return s === s.split('').reverse().join('');
```

## Installation & Setup

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
