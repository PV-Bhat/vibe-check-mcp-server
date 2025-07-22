# Testing Guide

Due to a bug in the `@modelcontextprotocol/sdk` client, the standard `test-client.js` script will not work. To test the server, you must use the `alt-test.js` script to generate a JSON request and pipe it to the server's standard input.

## Running Tests

1.  **Build the server:**
    ```bash
    npm run build
    ```
2.  **Generate the request:**
    The `alt-test.js` script generates a `request.json` file. You can modify this file to test different tool calls and arguments.
    ```bash
    node alt-test.js
    ```
3.  **Run the server with the request:**
    ```bash
    node build/index.js < request.json
    ```
    The server will process the request and print the response to standard output.

## Testing History

To test the history feature, run the test twice with the same `sessionId` in the `request.json` file. The second response should include a `History Context` section.
