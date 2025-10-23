# Testing Guide

The server now includes a JSON-RPC compatibility layer that backfills missing `id` fields on `tools/call` requests. This allows the stock `@modelcontextprotocol/sdk` client and Windsurf to work out of the box again—no custom request generators required. Clients should still send their own identifiers as required by JSON-RPC 2.0, but the shim keeps legacy integrations functional while they update.

## Running Tests

1.  **Build the server:**
    ```bash
    npm run build
    ```
2.  **Generate optional sample requests:**
    The legacy helper scripts are still available if you want ready-made payloads for manual testing, but they are no longer required for Windsurf or the SDK client.
    - `alt-test.js` (OpenRouter) writes `request1.json` and `request2.json` for history testing.
    - `alt-test-openai.js` generates `request.json` targeting the OpenAI provider.
    - `alt-test-gemini.js` generates `request.json` using the default Gemini provider.
    ```bash
    node alt-test.js            # OpenRouter history test
    node alt-test-openai.js     # OpenAI example
    node alt-test-gemini.js     # Gemini example
    ```
3.  **Run the server with the requests (optional):**
    Pipe the contents of each generated file to the server if you are using the helper scripts.

    **History test (OpenRouter):**
    ```bash
    node build/index.js < request1.json
    node build/index.js < request2.json
    ```
    **Single provider examples:**
    ```bash
    node build/index.js < request.json   # created by alt-test-openai.js or alt-test-gemini.js
    ```
    The server will process the requests and print the responses to standard output. The second OpenRouter call should show that the previous history was considered.

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
