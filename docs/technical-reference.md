# Technical Reference

This guide covers the tool schemas and expected responses for Vibe Check MCP.

## vibe_check
The core tool providing meta-mentor questions.

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| goal | string | yes | Overall objective of the agent |
| plan | string | yes | Current plan or reasoning |
| modelOverride | object | no | `{ provider, model }` to override default LLM |
| userPrompt | string | no | The full user request |
| progress | string | no | Status update on execution |
| uncertainties | string[] | no | Specific doubts or concerns |
| taskContext | string | no | Extra context about the task |
| sessionId | string | no | Identifier used to maintain history |

History from the session is automatically summarized and included in the prompt.

### Response
Returns `{ questions: string }` containing guidance questions.

## vibe_learn
Optional pattern logging tool.

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| mistake | string | yes | Short description of the issue |
| category | string | yes | Category of the pattern |
| solution | string | no | How it was fixed |
| type | string | no | `mistake`, `preference` or `success` |
| sessionId | string | no | Session identifier |

### Response
Returns confirmation of whether the entry was added and a summary of top categories.
