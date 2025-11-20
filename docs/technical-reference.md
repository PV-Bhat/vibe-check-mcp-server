# Technical Reference

This document provides detailed technical information about the Vibe Check MCP tools, including parameter specifications, response formats, and implementation details.

## vibe_check

The metacognitive questioning tool that identifies assumptions and breaks tunnel vision to prevent cascading errors.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| goal | string | Yes | High level objective for the current step |
| plan | string | Yes | Current plan or thinking |
| userPrompt | string | No | Original user request (critical for alignment) |
| progress | string | No | Description of progress so far |
| uncertainties | string[] | No | Explicit uncertainties to focus on |
| taskContext | string | No | Any additional task context |
| modelOverride | object | No | `{ provider, model }` to override default LLM |
| sessionId | string | No | Session ID for history continuity |

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
```

## vibe_learn

Pattern recognition system that creates a self-improving feedback loop by tracking common errors and their solutions over time. The use of this tool is optional and can be enabled or disabled via configuration.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| mistake | string | Yes | One-sentence description of the learning entry |
| category | string | Yes | Category (from standard categories) |
| solution | string | No | How it was corrected (required for `mistake` and `success`) |
| type | string | No | `mistake`, `preference`, or `success` |
| sessionId | string | No | Session ID for state management |

### Standard Categories

- Complex Solution Bias
- Feature Creep
- Premature Implementation
- Misalignment
- Overtooling
- Preference
- Success
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

Vibe Check uses the Gemini API for enhanced metacognitive questioning. The system attempts to use the `learnlm-2.0-flash-experimental` model and will fall back to `gemini-2.5-flash` or `gemini-2.0-flash` if needed. These models provide a 1M token context window, allowing vibe_check to incorporate a rich history of learning context. The system sends a structured prompt that includes the agent's plan, user request, and other context information to generate insightful questions and observations.

Example Gemini prompt structure:

```
You are a supportive mentor, thinker, and adaptive partner. Your task is to coordinate and mentor an AI agent...

CONTEXT:
[Current Phase]: planning
[Agent Confidence Level]: 50%
[User Request]: Create a script to analyze sales data from the past year
[Current Plan/Thinking]: I'll create a complex object-oriented architecture with...
```

### OAICompatible Provider Implementation

The OAICompatible provider uses the OpenAI client library with configurable endpoints, enabling support for any OpenAI-compatible API. This includes local models, proxy services, and alternative providers.

#### Initialization Pattern

```typescript
let oaiCompatibleClient: any;

// OAI-Compatible Configuration Interface
interface OAICompatibleConfig {
  apiKey: string;
  baseURL: string;
  timeout?: number;
}

// Configuration builder function
function buildOAICompatibleConfig(): OAICompatibleConfig | null {
  const apiKey = process.env.OAICOMPATIBLE_API_KEY;
  const baseURL = process.env.OAICOMPATIBLE_BASE_URL;

  if (!apiKey || !baseURL) {
    return null;
  }

  const config: OAICompatibleConfig = {
    apiKey,
    baseURL,
    timeout: process.env.OAICOMPATIBLE_TIMEOUT ?
      parseInt(process.env.OAICOMPATIBLE_TIMEOUT) : undefined,
  };

  return config;
}

async function ensureOAICompatible() {
  if (!oaiCompatibleClient && process.env.OAICOMPATIBLE_API_KEY && process.env.OAICOMPATIBLE_BASE_URL) {
    const { OpenAI } = await import('openai');

    // URL validation
    const baseURL = process.env.OAICOMPATIBLE_BASE_URL;
    if (!baseURL.startsWith('http://') && !baseURL.startsWith('https://')) {
      throw new Error('Invalid OAICOMPATIBLE_BASE_URL: must start with http:// or https://');
    }

    const clientConfig = buildOAICompatibleConfig();

    if (clientConfig) {
      console.log(`OAICompatible provider initialized with base URL: ${baseURL}`);
      oaiCompatibleClient = new OpenAI(clientConfig);
    }
  }
}
```

#### Usage Example

```javascript
// Using OAICompatible provider with custom endpoint
{
  "goal": "Test with custom endpoint",
  "plan": "Use OAICompatible provider",
  "modelOverride": {
    "provider": "oai-compatible",
    "model": "glm-4.6"  // Optional: will use OAICOMPATIBLE_MODEL if not specified
  }
}

// Model selection priority (highest to lowest):
// 1. Explicit model in modelOverride
// 2. OAICOMPATIBLE_MODEL environment variable
// 3. Default model (glm-4.6)
```

#### Supported Use Cases

- **Local Models**: Ollama, LM Studio with OpenAI compatibility mode
- **Proxy Services**: Services that provide OpenAI-compatible endpoints
- **Alternative Providers**: Companies like iflow API offering 100% OpenAI-compatible endpoints
- **Development**: Testing against mock endpoints or staging environments

Other providers such as OpenAI and OpenRouter can be selected by passing
`modelOverride: { provider: 'openai', model: 'gpt-4o' }` or the appropriate
OpenRouter model. LLM clients are lazily initialized the first time they are
used so that listing tools does not require API keys.

#### Enhanced Response Validation

The OAI-compatible provider includes comprehensive response validation:

```javascript
// Enhanced validation checks
if (!response.choices || response.choices.length === 0) {
  throw new Error(`OAICompatible API returned no choices. Response: ${JSON.stringify(response)}`);
}

if (!response.choices[0]?.message) {
  throw new Error(`OAICompatible API returned invalid message structure. Response: ${JSON.stringify(response)}`);
}

const content = response.choices[0].message.content;
if (content === null || content === undefined) {
  throw new Error(`OAICompatible API returned null/undefined content. Response: ${JSON.stringify(response)}`);
}
```

This ensures robust error handling and clear error messages for debugging.

### Storage System

The pattern recognition system stores learning entries (mistakes, preferences and successes) in a JSON-based storage file located in the user's home directory (`~/.vibe-check/vibe-log.json`). This allows for persistent tracking of patterns across sessions and enables the self-improving feedback loop that becomes more effective over time.

### Error Handling

Vibe Check includes fallback mechanisms for when the API is unavailable:

- For vibe_check, it generates basic questions based on the phase
- For vibe_learn, it logs patterns to local storage even if API calls fail