// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
    CallToolRequest,
    InitializeRequest,
    InitializeRequestSchema
    // Removed ToolDefinition import as it's not found
} from "@modelcontextprotocol/sdk/types.js";
import { vibeCheckTool } from "./tools/vibeCheck.js";
import { vibeDistillTool } from "./tools/vibeDistill.js";
import { vibeLearnTool, VibeLearnOutput } from "./tools/vibeLearn.js";
import { MistakeEntry } from "./utils/storage.js";
import { initializeGemini } from "./utils/gemini.js";

console.error("MCP Server: Script starting...");

// --- Explicitly Initialize Gemini ---
try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("MCP Server: WARNING - GEMINI_API_KEY environment variable not found!");
    } else {
        initializeGemini(apiKey);
        console.error("MCP Server: Gemini client potentially initialized.");
    }
} catch (err: any) {
    console.error("MCP Server: ERROR initializing Gemini client -", err);
}
// ------------------------------------

type CategorySummaryItem = {
  category: string;
  count: number;
  recentExample: MistakeEntry;
};

console.error("MCP Server: Creating Server instance...");
const server = new Server({
  name: "vibe-check-mcp",
  version: "0.2.0"
});
console.error("MCP Server: Server instance created.");

// --- Initialize handler ---
server.setRequestHandler(InitializeRequestSchema, async (request: InitializeRequest) => {
    console.error(`MCP Server: Received initialize request`);
    const response = {
        protocolVersion: request.params.protocolVersion,
        serverInfo: {
            name: "vibe-check-mcp",
            version: "0.2.0",
        },
        capabilities: {}
    };
    console.error(`MCP Server: Sending initialize response`);
    return response;
});
// -----------------------------------------------------

// Define tools using ListToolsRequestSchema handler
console.error("MCP Server: Setting ListTools request handler...");
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("MCP Server: ListTools request received.");
  // Remove explicit ToolDefinition[] type, let TypeScript infer
  const tools = [
     {
      name: "vibe_check",
      description: "Metacognitive check for plan alignment and assumption testing.",
      inputSchema: {
        type: "object",
        properties: {
          plan: { type: "string" },
          userRequest: { type: "string" },
          // ... other properties ...
          confidence: { type: "number" }
        },
        required: ["plan", "userRequest"]
      }
    },
    {
      name: "vibe_distill",
      description: "Distills a plan to its essential core.",
      inputSchema: {
        type: "object",
        properties: {
            plan: { type: "string" },
            userRequest: { type: "string" },
            sessionId: { type: "string" }
        },
        required: ["plan", "userRequest"]
      }
    },
    {
        name: "vibe_learn",
        description: "Logs mistake patterns for future improvement.",
        inputSchema: {
            type: "object",
            properties: {
                mistake: { type: "string" },
                category: { type: "string" },
                solution: { type: "string" },
                sessionId: { type: "string" }
            },
            required: ["mistake", "category", "solution"]
        }
    }
  ];
   console.error("MCP Server: Returning tool list.");
   return { tools };
});
console.error("MCP Server: ListTools request handler set.");

// Handle tool calls using CallToolRequestSchema handler
console.error("MCP Server: Setting CallTool request handler...");
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const toolName = request.params.name;
  const args = request.params.arguments ?? {};

  console.error(`MCP Server: CallToolRequest received for tool: ${toolName}`);

  try {
    let result: any;
    console.error(`MCP Server: Executing tool: ${toolName}...`);
    switch (toolName) {
      case 'vibe_check':
        result = await vibeCheckTool(args as any);
        console.error(`MCP Server: Tool ${toolName} executed successfully.`);
        return { content: [{ type: "text", text: result.questions + (result.patternAlert ? `\n\n**Pattern Alert:** ${result.patternAlert}`: "") }] };
      case 'vibe_distill':
         result = await vibeDistillTool(args as any);
         console.error(`MCP Server: Tool ${toolName} executed successfully.`);
         return { content: [{ type: "markdown", markdown: result.distilledPlan + `\n\n**Rationale:** ${result.rationale}` }] };
      case 'vibe_learn':
        result = await vibeLearnTool(args as any) as VibeLearnOutput;
        console.error(`MCP Server: Tool ${toolName} executed successfully.`);
        const summary = result.topCategories.map((cat: CategorySummaryItem) => `- ${cat.category} (${cat.count})`).join('\n');
        return { content: [{ type: "text", text: `✅ Pattern logged. Tally for category: ${result.currentTally}.\nTop Categories:\n${summary}` }] };
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

// Assign callback to 'onclose' property instead of calling it
if (transport.onclose) { // Check if property exists
    transport.onclose = () => { // Assign the callback function
        console.error("MCP Server: Transport closed event received.");
    };
} else {
     console.error("MCP Server: transport.onclose property not found.");
}

// Removed listener for non-existent onDidDispose
