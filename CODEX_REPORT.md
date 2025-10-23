# CODEX Report

## Audit notes
- JSON-RPC requests reach the server over both stdio and HTTP: stdio connections wrap the transport before `server.connect` and HTTP posts pass through the `/mcp` router that applies the compatibility shim before delegating to `StreamableHTTPServerTransport`.【F:src/index.ts†L331-L398】【F:src/index.ts†L445-L456】
- When `MCP_TRANSPORT=stdio`, `console.log` is redirected to `console.error` so logs land on stderr, satisfying the requirement to keep stdout clean for protocol traffic.【F:src/index.ts†L24-L29】
- Missing-parameter paths now raise `McpError` with `InvalidParams` in both normal and discovery modes, ensuring consistent error propagation while still surfacing discovery hints in the message.【F:src/index.ts†L214-L304】
- HTTP handling normalizes `Accept` headers, forces JSON responses when the client omits `text/event-stream`, and restores the transport flag once the response finishes, so both JSON and SSE clients receive replies.【F:src/index.ts†L331-L398】
- The server version is sourced from `package.json` via the cached helper, and reported when constructing the MCP `Server` instance.【F:src/utils/version.ts†L1-L21】【F:src/index.ts†L60-L67】
- Packaging remains ESM-only with explicit `main`, `bin`, and `files` entries; scripts cover build/test/publish flows and Node 20+ is enforced via `engines`.【F:package.json†L1-L52】
- Request logging records identifiers, method names, and session IDs but avoids dumping tool arguments or secrets, reducing leakage risk.【F:src/index.ts†L377-L398】

## Changes implemented
- Added nonce-aware compat ID synthesis and exported `formatCompatId`, while updating the transport wrapper to cover handlers assigned after wrapping without double-wrapping.【F:src/utils/jsonRpcCompat.ts†L10-L101】
- Normalized HTTP `Accept` headers, toggled JSON responses for legacy clients, and restored transport state after each request; also tightened invalid-parameter handling to throw consistently in discovery mode.【F:src/index.ts†L214-L398】
- Expanded regression coverage for nonce uniqueness, handler reassignment, discovery-mode errors, large payloads, HTTP JSON/SSE flows, and stdio log routing.【F:tests/jsonrpc-compat.test.ts†L1-L294】
- Refreshed quickstart/testing docs to clarify that the shim mitigates missing IDs without replacing proper JSON-RPC behavior, and added troubleshooting guidance for notification requests.【F:docs/TESTING.md†L1-L38】【F:docs/AGENTS.md†L28-L40】【F:docs/gemini.md†L28-L40】

## Tests & commands
- `npm ci`【460f54†L1-L11】
- `npm run build`【1d805f†L1-L5】
- `npm test -- --run`【8119f6†L1-L26】
- `node alt-test-gemini.js`【a730d1†L1-L2】
- `node build/index.js < request.json` (server started; interrupted after confirming startup)【5c7344†L1-L2】【ae8750†L1-L1】
- `node -e "http=require('http'); …"` JSON-RPC smoke request【bfffdb†L1-L5】
