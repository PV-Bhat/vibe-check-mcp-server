// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"; // <-- Use McpServer from mcp.js
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"; // <-- Use StdioServerTransport from stdio.js
import { ListToolsRequestSchema, CallToolRequestSchema, CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { vibeCheckTool } from "./tools/vibeCheck.js";
import { vibeDistillTool } from "./tools/vibeDistill.js";
import { vibeLearnTool, VibeLearnOutput } from "./tools/vibeLearn.js";
import { MistakeEntry } from "./utils/storage.js";

// Define the type for the 'cat' parameter explicitly
type CategorySummaryItem = {
  category: string;
  count: number;
  recentExample: MistakeEntry;
};

// Create server instance using the correct class name and constructor signature from the example
const server = new McpServer({ // <-- Use McpServer, 1 argument
  name: "vibe-check-mcp",
  version: "0.2.0" // Ensure this matches your package.json
});

// Define tools using ListToolsRequestSchema handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
     {
      name: "vibe_check",
      description: "Metacognitive check for plan alignment and assumption testing.",
      inputSchema: {
        type: "object",
        properties: {
          plan: { type: "string" },
          userRequest: { type: "string" },
          thinkingLog: { type: "string" },
          availableTools: { type: "array", items: { type: "string" } },
          focusAreas: { type: "array", items: { type: "string" } },
          sessionId: { type: "string" },
          previousAdvice: { type: "string" },
          phase: { type: "string", enum: ["planning", "implementation", "review"] },
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
    // ... other tool definitions
  ]
}));

// Handle tool calls using CallToolRequestSchema handler
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const toolName = request.params.name;
  const args = request.params.arguments ?? {};

  console.log(`CallToolRequest received for tool: ${toolName}`);

  try {
    let result: any;
    switch (toolName) {
      case 'vibe_check':
        result = await vibeCheckTool(args as any);
         return { content: [{ type: "text", text: result.questions + (result.patternAlert ? `\n\n**Pattern Alert:** ${result.patternAlert}`: "") }] };
      case 'vibe_distill':
        result = await vibeDistillTool(args as any);
        return { content: [{ type: "markdown", markdown: result.distilledPlan + `\n\n**Rationale:** ${result.rationale}` }] };
      case 'vibe_learn':
        result = await vibeLearnTool(args as any) as VibeLearnOutput;
        // Apply explicit type to 'cat' parameter
        const summary = result.topCategories.map((cat: CategorySummaryItem) => `- ${cat.category} (${cat.count})`).join('\n');
        return { content: [{ type: "text", text: `✅ Pattern logged. Tally for category: ${result.currentTally}.\nTop Categories:\n${summary}` }] };
      default:
        throw new Error(`Tool '${toolName}' not found.`);
    }
  } catch (error: any) {
      console.error(`Error executing tool ${toolName}:`, error);
      return {
          error: {
              code: "tool_execution_error",
              message: `Error executing tool ${toolName}: ${error.message}`
          }
      };
  }
});

// Create the transport instance using the correct class name
const transport = new StdioServerTransport(); // <-- Use StdioServerTransport

// Connect the server and transport as shown in the example
server.connect(transport);

console.log("Vibe Check MCP Server started using StdioTransport.");
