# API Documentation

## Overview

The Vibe Check MCP server provides a comprehensive API for metacognitive oversight of AI agents. This document describes the available tools and their usage.

## MCP Tools

### vibe_check

Challenges assumptions and prevents tunnel vision in AI agents.

**Parameters:**
- `goal` (string, required): The agent's current goal
- `plan` (string, required): The agent's detailed plan
- `sessionId` (string, optional): Session ID for context continuity

**Example:**
```json
{
  "goal": "Write unit tests for the authentication module",
  "plan": "1. Review existing code 2. Write test cases 3. Run tests 4. Fix any issues",
  "sessionId": "session-123"
}
```

### vibe_learn

Captures mistakes, preferences, and successes for future analysis.

**Parameters:**
- `mistake` (string, required): Description of the learning item
- `category` (string, required): Category type
- `solution` (string, optional): How the issue was corrected
- `type` (string, required): Learning entry type
- `sessionId` (string, optional): Session identifier

**Example:**
```json
{
  "mistake": "Forgot to handle edge cases in input validation",
  "category": "Premature Implementation",
  "solution": "Added comprehensive input validation with error handling",
  "type": "mistake",
  "sessionId": "session-123"
}
```

### update_constitution

Sets or merges session rules that CPI will enforce.

**Parameters:**
- `sessionId` (string, required): Session identifier
- `rules` (string[], required): Array of constitutional rules

**Example:**
```json
{
  "sessionId": "session-123",
  "rules": ["No external network calls", "Write tests before refactoring"]
}
```

### reset_constitution

Clears rules for a session.

**Parameters:**
- `sessionId` (string, required): Session identifier
- `rules` (string[], optional): New set of rules (empty array to clear all)

### check_constitution

Inspects effective rules for a session.

**Parameters:**
- `sessionId` (string, required): Session identifier

**Returns:** JSON string containing current session rules.

## Transport Modes

### STDIO Mode
Direct communication with MCP clients through standard input/output.

### HTTP Mode
Web-based communication with HTTP endpoints:
- **MCP Endpoint:** `POST /mcp`
- **Health Check:** `GET /`

## Error Handling

The server provides comprehensive error handling with:
- Detailed error messages
- Actionable suggestions
- Recovery recommendations
- Graceful degradation

## Configuration

Configuration is managed through:
- Environment variables
- Configuration files
- CLI parameters

For detailed configuration options, see the [CLI Reference](./cli-reference.md).