// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioTransport } from "@modelcontextprotocol/sdk/server/stdio.js"; // <-- Original path with .js
import { ListToolsRequestSchema, CallToolRequestSchema, CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { vibeCheckTool } from "./tools/vibeCheck.js"; // <-- Local import needs .js
import { vibeDistillTool } from "./tools/vibeDistill.js"; // <-- Local import needs .js
import { vibeLearnTool } from "./tools/vibeLearn.js"; // <-- Local import needs .js

// Create server with required parameters
const server = new Server({ // Leaving as is for now, hoping TS2554 resolves with other fixes
  name: "vibe-check-mcp",
  version: "0.2.0"
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
  ]
}));

// Handle tool calls using CallToolRequestSchema handler
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const toolName = request.params.name; // <-- Corrected access
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
        result = await vibeLearnTool(args as any);
        const summary = result.topCategories.map(cat => `- ${cat.category} (${cat.count})`).join('\n');
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

// Use StdioTransport for compatibility
const transport = new StdioTransport();
server.connect(transport);

console.log("Vibe Check MCP Server started using StdioTransport.");
