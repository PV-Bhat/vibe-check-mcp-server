# Metacognitive Architecture

This document visualizes the metacognitive architecture of Vibe Check and explains how the components work together to create a complete pattern interrupt system for AI agents.

## System Architecture

```
                          ┌────────────────────────────────────┐
                          │         User + AI Agent            │
                          └───────────────┬────────────────────┘
                                          │
                                          ▼
                ┌─────────────────────────────────────────────────┐
                │                  Agent Workflow                  │
                │                                                 │
                │    ┌───────┐      ┌───────┐      ┌───────┐      │
                │    │Planning│ ──▶ │Implement│ ──▶ │ Review │      │
                │    └───┬───┘      └───┬───┘      └───┬───┘      │
                │        │              │              │          │
                └────────┼──────────────┼──────────────┼──────────┘
                         │              │              │           
                         ▼              ▼              ▼           
┌────────────────────────────────────────────────────────────────────────┐
│                      Metacognitive Layer (Vibe Check)                   │
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────────┐  │
│  │   vibe_check    │◀──▶│     vibe_learn      │  │
│  │                 │    │                     │  │
│  │ Pattern Interrupt│    │ Self-Improving      │  │
│  │    Mechanism    │    │   Feedback Loop     │  │
│  └────────┬────────┘    └─────────┬───────────┘  │
│           │                       │               │
└───────────┼──────────────────────┼───────────────────────┼───────────────┘
            │                      │                       │                
            ▼                      ▼                       ▼                
┌───────────────────┐                 ┌───────────────────────────┐
│  Phase-Specific   │                 │  Pattern Recognition      │
│   Metacognitive   │                 │    Database and          │
│    Questions      │                 │   Category Analysis       │
└───────────────────┘                 └───────────────────────────┘
```

## Component Interactions

### 1. vibe_check (Pattern Interrupt)

The `vibe_check` tool serves as the primary pattern interrupt mechanism. It works by:

1. Receiving the current plan or thinking from the agent
2. Analyzing it for potential misalignments, tunnel vision, or overengineering
3. Generating phase-appropriate metacognitive questions
4. Identifying potential pattern matches with previous issues

The output creates a moment of pause and reflection, forcing the agent to reconsider its approach before continuing. This is critical because LLM agents lack natural mechanisms for self-doubt and course correction.

### 2. vibe_learn (Feedback Loop)

The `vibe_learn` tool creates a self-improving feedback loop by:

1. Recording specific instances of mistakes and their solutions
2. Categorizing these patterns into meaningful groups
3. Building a knowledge base of common error patterns
4. Feeding this information back into the pattern recognition process

Over time, this creates a more sophisticated pattern recognition system that can identify potential issues earlier and with greater accuracy.

## Integration Flow

The three components can be used independently but are designed to work together in an integrated metacognitive layer:

1. **Planning Phase**: `vibe_check` identifies potential issues in the initial plan and encourages simplification if overengineering is detected.

2. **Implementation Phase**: `vibe_check` with higher confidence provides more focused feedback on specific implementation decisions, referencing patterns from `vibe_learn`.

3. **Review Phase**: `vibe_check` ensures the final solution aligns with the original intent, while `vibe_learn` captures any issues that were identified for future improvement.

4. **Across Workflows**: As more patterns are recorded via `vibe_learn`, the pattern recognition capabilities of the system improve, making `vibe_check` increasingly effective at identifying potential issues early.

## Metacognitive Principles

This architecture embodies several key principles from metacognitive theory:

1. **External Reflection**: Providing the reflection capabilities that agents lack internally
2. **Strategic Interruption**: Timing interrupts to maximize impact on the workflow
3. **Phase Awareness**: Tailoring metacognitive feedback to different cognitive stages
4. **Pattern Recognition**: Leveraging past experiences to improve future interventions
5. **Complexity Management**: Summarizing large context windows to keep reasoning
   focused without overwhelming the agent

The result is a complete metacognitive layer that compensates for the inherent limitations of LLM agents in questioning their own reasoning processes.