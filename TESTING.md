# Testing Guide

Due to a bug in the `@modelcontextprotocol/sdk` client, the standard `test-client.js` script will not work. To test the server, you must use the `alt-test.js` script to generate JSON request files and pipe them to the server's standard input.

## Running Tests

1.  **Build the server:**
    ```bash
    npm run build
    ```
2.  **Generate the requests:**
    The `alt-test.js` script generates `request1.json` and `request2.json` files. These are designed to test the history functionality by using the same `sessionId`. You can modify `alt-test.js` to change the tool call arguments.
    ```bash
    node alt-test.js
    ```
3.  **Run the server with the requests:**
    Pipe the contents of each file to a separate server instance.

    **First call (to establish history):**
    ```bash
    node build/index.js < request1.json
    ```
    **Second call (to verify history):**
    ```bash
    node build/index.js < request2.json
    ```
    The server will process the requests and print the responses to standard output. The second call's output should demonstrate that the history from the first call was considered.
