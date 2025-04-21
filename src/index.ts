// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema, CallToolRequest, InitializeRequest } from "@modelcontextprotocol/sdk/types.js"; // Added InitializeRequest
import { vibeCheckTool } from "./tools/vibeCheck.js";
import { vibeDistillTool } from "./tools/vibeDistill.js";
import { vibeLearnTool, VibeLearnOutput } from "./tools/vibeLearn.js";
import { MistakeEntry } from "./utils/storage.js";
import { initializeGemini } from "./utils/gemini.js"; // Import gemini initializer

console.error("MCP Server: Script starting..."); // Log to stderr

// --- Explicitly Initialize Gemini ---
try {
    const apiKey = process.env.GEMINI_API_KEY; // Read from env var
    if (!apiKey) {
        console.error("MCP Server: ERROR - GEMINI_API_KEY environment variable not found!");
        // Optionally exit if the key is absolutely required at startup
        // process.exit(1);
    } else {
        initializeGemini(apiKey);
        console.error("MCP Server: Gemini client potentially initialized (check gemini.ts logs).");
    }
} catch (err: any) {
    console.error("MCP Server: ERROR initializing Gemini client -", err);
    // Optionally exit
    // process.exit(1);
}
// ------------------------------------


// Define the type for the 'cat' parameter explicitly
type CategorySummaryItem = {
  category: string;
  count: number;
  recentExample: MistakeEntry;
};

// Create server instance
console.error("MCP Server: Creating Server instance...");
const server = new Server({
  name: "vibe-check-mcp",
  version: "0.2.0"
});
console.error("MCP Server: Server instance created.");

// --- Add an explicit Initialize handler for logging ---
server.setRequestHandler("initialize", async (request: InitializeRequest) => {
    console.error(`MCP Server: Received initialize request: ID=${request.id}`);
    // Basic response - the SDK might override parts of this, but it confirms handling
    const response = {
        protocolVersion: "2024-11-05", // Use the version client sent or latest known
        serverInfo: {
            name: "vibe-check-mcp",
            version: "0.2.0",
        },
        capabilities: {
             // Declare capabilities if needed, e.g., for notifications
        }
    };
    console.error(`MCP Server: Sending initialize response for ID=${request.id}`);
    return response;
});
// -----------------------------------------------------


// Define tools using ListToolsRequestSchema handler
console.error("MCP Server: Setting ListTools request handler...");
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("MCP Server: ListTools request received.");
  // Your tool definitions...
  const tools = [ /* ... your tool definitions from previous code ... */ ];
   console.error("MCP Server: Returning tool list.");
   return { tools };
});
console.error("MCP Server: ListTools request handler set.");


// Handle tool calls using CallToolRequestSchema handler
console.error("MCP Server: Setting CallTool request handler...");
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const toolName = request.params.name;
  const args = request.params.arguments ?? {};

  // Log received request details to stderr
  console.error(`MCP Server: CallToolRequest received for tool: ${toolName} with ID: ${request.id}`);
  // console.error(`MCP Server: Args: ${JSON.stringify(args)}`); // Be careful logging args if sensitive

  try {
    let result: any;
    console.error(`MCP Server: Executing tool: ${toolName}...`);
    switch (toolName) {
      case 'vibe_check':
        result = await vibeCheckTool(args as any);
        console.error(`MCP Server: Tool ${toolName} executed successfully.`);
        return { content: [{ type: "text", text: result.questions + (result.patternAlert ? `\n\n**Pattern Alert:** ${result.patternAlert}`: "") }] };
      // ... other cases ...
      default:
        console.error(`MCP Server: Tool '${toolName}' not found.`);
        throw new Error(`Tool '${toolName}' not found.`);
    }
  } catch (error: any) {
      console.error(`MCP Server: Error executing tool ${toolName}:`, error);
      return {
          error: {
              code: "tool_execution_error",
              message: `Error executing tool ${toolName}: ${error.message}`
          }
      };
  }
});
console.error("MCP Server: CallTool request handler set.");


// Create the transport instance
console.error("MCP Server: Creating StdioServerTransport...");
const transport = new StdioServerTransport();
console.error("MCP Server: StdioServerTransport created.");

// Connect the server and transport
console.error("MCP Server: Connecting server to transport...");
server.connect(transport);
console.error("MCP Server: Server connected to transport. Ready for messages.");

// Optional: Add listeners for transport errors/close events
transport.onDidClose(() => {
    console.error("MCP Server: Transport closed event received.");
});
transport.onDidDispose(() => {
    console.error("MCP Server: Transport disposed event received.");
});
