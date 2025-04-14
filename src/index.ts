import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebSocketServerTransport } from "@modelcontextprotocol/sdk/server/websocket.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "vibe-check-test" });

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

const transport = new WebSocketServerTransport({ port: 3000 });
server.connect(transport);
