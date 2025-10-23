# Testing Guide

The repository ships with a working STDIO client (`test-client.ts` / `test-client.js`) that exercises the same JSON-RPC payloads as manual request files. The helper bypasses the buggy high-level SDK helpers by sending a numeric `id` and raw `tools/call` request through the transport so STDIO consumers receive a proper response.

## Running Tests

1.  **Build the server:**
    ```bash
    npm run build
    ```
2.  **Invoke the STDIO client:**
    ```bash
    node test-client.js
    # or, if you prefer TypeScript directly:
    npx tsx test-client.ts
    ```
    The script spawns the compiled server, sends a JSON-RPC `tools/call` request with a numeric `id`, and prints the response once it arrives.
3.  **Generate manual requests (optional):**
    The alternative scripts remain available when you need to pipe handcrafted payloads into the server.
    - `alt-test.js` (OpenRouter) writes `request1.json` and `request2.json` for history testing.
    - `alt-test-openai.js` generates `request.json` targeting the OpenAI provider.
    - `alt-test-gemini.js` generates `request.json` using the default Gemini provider.
    ```bash
    node alt-test.js            # OpenRouter history test
    node alt-test-openai.js     # OpenAI example
    node alt-test-gemini.js     # Gemini example
    ```
    Each script produces the JSON you can pipe to `node build/index.js < request.json`.

### Example STDIO request

The client and regression test both send payloads shaped like the following:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "vibe_check",
    "arguments": {
      "goal": "Implement the core logic for the new feature",
      "plan": "1. Define the data structures. 2. Implement the main algorithm. 3. Add error handling.",
      "progress": "Just started"
    }
  }
}
```

## Unit Tests with Vitest

Vitest is used for unit and integration tests. Run all tests with:
```bash
npm test
```
Generate a coverage report (outputs to `coverage/`):
```bash
npm run test:coverage
```
All tests should pass with at least 80% line coverage.
