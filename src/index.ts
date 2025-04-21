// src/index.ts
import { Server, StdioTransport } from "@modelcontextprotocol/sdk/server/index.js"; // <--- Try importing StdioTransport from here
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Create server with required parameters
const server = new Server({
  name: "vibe-check-mcp",
  version: "0.2.0"
});
// Note: If the TS2554 error persists after fixing the import,
// you might need to check the SDK v0.6.0 docs for the correct Server constructor signature.

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "vibe_check",
      description: "Quick test tool",
      inputSchema: {
        type: "object",
        properties: {
          plan: { type: "string" },
          userRequest: { type: "string" }
        },
        required: ["plan", "userRequest"]
      }
    }
    // TODO: Add back your actual vibe_check, vibe_distill, vibe_learn tool definitions here
  ]
}));

// TODO: Add back your CallToolRequestSchema handler for the actual tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Replace this placeholder with your actual tool calling logic
  console.log("CallToolRequest:", request);
  if (request.toolName === 'vibe_check') {
     return {
        content: [{ type: "text", text: "✅ Test successful. This is a working vibe_check response." }]
     };
  }
  // Add handlers for vibe_distill and vibe_learn
  throw new Error(`Tool ${request.toolName} not found or handler not implemented.`);
});

// Use StdioTransport for compatibility
const transport = new StdioTransport(); // Instantiation looks correct
server.connect(transport);

console.log("Vibe Check MCP Server started using StdioTransport."); // Add a log message
