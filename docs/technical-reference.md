# Technical Reference

This document provides detailed technical information about the Vibe Check MCP tools, including parameter specifications, response formats, and implementation details.

## vibe_check

The metacognitive questioning tool that identifies assumptions and breaks tunnel vision to prevent cascading errors.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| plan | string | Yes | Current plan or thinking |
| userRequest | string | Yes | Original user request (critical for alignment) |
| thinkingLog | string | No | Raw sequential thinking transcript |
| availableTools | string[] | No | List of available MCP tools |
| focusAreas | string[] | No | Optional specific focus areas |
| sessionId | string | No | Session ID for state management |
| previousAdvice | string | No | Previous feedback to avoid repetition |
| phase | string | No | Current project phase ("planning", "implementation", "review") |
| confidence | number | No | Agent's confidence level (0-1) |

### Response Format

The vibe_check tool returns a text response with metacognitive questions, observations, and potentially a pattern alert.

Example response:

```
I see you're taking an approach based on creating a complex class hierarchy. This seems well-thought-out for a large system, though I wonder if we're overengineering for the current use case.

Have we considered:
1. Whether a simpler functional approach might work here?
2. If the user request actually requires this level of abstraction?
3. How this approach will scale if requirements change?

While the architecture is clean, I'm curious if we're solving a different problem than what the user actually asked for, which was just to extract data from a CSV file.

**I notice a pattern emerging:** This approach resembles previous solutions that introduced unnecessary complexity for simple data tasks.
```

## vibe_distill

Meta-thinking anchor point that recalibrates complex workflows by extracting essential elements and reducing scope creep.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| plan | string | Yes | The plan to distill |
| userRequest | string | Yes | Original user request |
| sessionId | string | No | Session ID for state management |

### Response Format

The vibe_distill tool returns a distilled plan in markdown format with essential actions and core logic extracted. This serves as a recalibration point in large workflows, helping agents refocus on what really matters.

Example response:

```markdown
# Distilled Plan

## Essential Actions
- Read the CSV file using PapaParse
- Filter rows based on date range
- Calculate mean and standard deviation
- Output results as JSON

## Core Logic
The solution only requires file I/O, basic filtering, and statistical operations. No complex architecture needed.
```

## vibe_learn

Pattern recognition system that creates a self-improving feedback loop by tracking common errors and their solutions over time.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| mistake | string | Yes | One-sentence description of the mistake |
| category | string | Yes | Category of mistake (from standard categories) |
| solution | string | Yes | How it was corrected (one sentence) |
| sessionId | string | No | Session ID for state management |

### Standard Categories

- Complex Solution Bias
- Feature Creep
- Premature Implementation
- Misalignment
- Overtooling
- Other

### Response Format

The vibe_learn tool returns a confirmation of the logged pattern and optionally information about top patterns. This builds a knowledge base that improves the system's pattern recognition over time.

Example response:

```
✅ Pattern logged successfully (category tally: 12)

## Top Pattern Categories

### Complex Solution Bias (12 occurrences)
Most recent: "Added unnecessary class hierarchy for simple data transformation"
Solution: "Replaced with functional approach using built-in methods"

### Misalignment (8 occurrences)
Most recent: "Implemented sophisticated UI when user only needed command line tool"
Solution: "Refocused on core functionality requested by user"
```

## Implementation Notes

### Gemini API Integration

Vibe Check uses the Gemini API for enhanced metacognitive questioning. The system sends a structured prompt that includes the agent's plan, user request, and other context information to generate insightful questions and observations.

Example Gemini prompt structure:

```
You are a supportive mentor, thinker, and adaptive partner. Your task is to coordinate and mentor an AI agent...

CONTEXT:
[Current Phase]: planning
[Agent Confidence Level]: 50%
[User Request]: Create a script to analyze sales data from the past year
[Current Plan/Thinking]: I'll create a complex object-oriented architecture with...
```

### Storage System

The pattern recognition system stores mistakes and solutions in a JSON-based storage system located in the user's home directory (`~/.vibe-check/vibe-log.json`). This allows for persistent tracking of patterns across sessions and enables the self-improving feedback loop that becomes more effective over time.

### Error Handling

Vibe Check includes fallback mechanisms for when the API is unavailable:

- For vibe_check, it generates basic questions based on the phase
- For vibe_distill, it performs simple text extraction
- For vibe_learn, it logs patterns to local storage even if API calls fail