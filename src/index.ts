import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Create server with required parameters
const server = new Server({ 
  name: "vibe-check-mcp",
  version: "0.2.0"
});

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
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async () => ({
  content: [{ type: "text", text: "✅ Test successful. This is a working vibe_check response." }]
}));

// Use StdioTransport for compatibility with current MCP SDK version
const transport = new StdioTransport();
server.connect(transport);
