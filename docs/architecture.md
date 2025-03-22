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
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐  │
│  │   vibe_check    │◀──▶│   vibe_distill  │◀──▶│     vibe_learn      │  │
│  │                 │    │                 │    │                     │  │
│  │ Pattern Interrupt│    │  Meta-Thinking  │    │ Self-Improving      │  │
│  │    Mechanism    │    │   Anchor Point  │    │   Feedback Loop     │  │
│  └────────┬────────┘    └────────┬────────┘    └─────────┬───────────┘  │
│           │                      │                       │               │
└───────────┼──────────────────────┼───────────────────────┼───────────────┘
            │                      │                       │                
            ▼                      ▼                       ▼                
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────────┐
│  Phase-Specific   │  │   Plan Distillation│  │  Pattern Recognition      │
│   Metacognitive   │  │    and Essential   │  │    Database and          │
│    Questions      │  │  Element Extraction│  │   Category Analysis       │
└───────────────────┘  └───────────────────┘  └───────────────────────────┘
```

## Component Interactions

### 1. vibe_check (Pattern Interrupt)

The `vibe_check` tool serves as the primary pattern interrupt mechanism. It works by:

1. Receiving the current plan or thinking from the agent
2. Analyzing it for potential misalignments, tunnel vision, or overengineering
3. Generating phase-appropriate metacognitive questions
4. Identifying potential pattern matches with previous issues

The output creates a moment of pause and reflection, forcing the agent to reconsider its approach before continuing. This is critical because LLM agents lack natural mechanisms for self-doubt and course correction.

### 2. vibe_distill (Anchor Point)

The `vibe_distill` tool provides a recalibration mechanism through:

1. Taking a complex, potentially overengineered plan
2. Extracting the essential elements and core requirements
3. Removing unnecessary complexity and scope creep
4. Creating a simplified "anchor" that the agent can return to

This serves as both a corrective mechanism and a reference point for future planning, helping to prevent drift in complex workflows.

### 3. vibe_learn (Feedback Loop)

The `vibe_learn` tool creates a self-improving feedback loop by:

1. Recording specific instances of mistakes and their solutions
2. Categorizing these patterns into meaningful groups
3. Building a knowledge base of common error patterns
4. Feeding this information back into the pattern recognition process

Over time, this creates a more sophisticated pattern recognition system that can identify potential issues earlier and with greater accuracy.

## Integration Flow

The three components can be used independently but are designed to work together in an integrated metacognitive layer:

1. **Planning Phase**: `vibe_check` identifies potential issues in the initial plan, potentially triggering `vibe_distill` if overengineering is detected.

2. **Implementation Phase**: `vibe_check` with higher confidence provides more focused feedback on specific implementation decisions, referencing patterns from `vibe_learn`.

3. **Review Phase**: `vibe_check` ensures the final solution aligns with the original intent, while `vibe_learn` captures any issues that were identified for future improvement.

4. **Across Workflows**: As more patterns are recorded via `vibe_learn`, the pattern recognition capabilities of the system improve, making `vibe_check` increasingly effective at identifying potential issues early.

## Metacognitive Principles

This architecture embodies several key principles from metacognitive theory:

1. **External Reflection**: Providing the reflection capabilities that agents lack internally
2. **Strategic Interruption**: Timing interrupts to maximize impact on the workflow
3. **Phase Awareness**: Tailoring metacognitive feedback to different cognitive stages
4. **Pattern Recognition**: Leveraging past experiences to improve future interventions
5. **Complexity Management**: Using distillation to manage cognitive load and scope

The result is a complete metacognitive layer that compensates for the inherent limitations of LLM agents in questioning their own reasoning processes.