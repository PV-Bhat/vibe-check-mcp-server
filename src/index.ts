// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js"; // Use Server class
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  InitializeRequest,
  CallToolRequest,
  // Types below might not be directly exported, handle based on usage
  // ListToolsResponse,
  // CallToolResponse,
  // ToolDescription // Define locally if not exported
} from "@modelcontextprotocol/sdk/types.js";
import { z, ZodTypeAny } from "zod"; // Import Zod and ZodTypeAny

// Import tool implementation functions and their specific Input/Output types
import { vibeCheckTool, VibeCheckInput, VibeCheckOutput } from "./tools/vibeCheck.js";
import { vibeDistillTool, VibeDistillInput, VibeDistillOutput } from "./tools/vibeDistill.js";
import { vibeLearnTool, VibeLearnInput, VibeLearnOutput } from "./tools/vibeLearn.js";
import { initializeGemini } from "./utils/gemini.js";
import { MistakeEntry } from "./utils/storage.js"; // Ensure this is imported

console.error("[LOG] MCP Server: Script starting...");

// ────────────────────────────────────────────────────────────────────────
// 0. Local type definition (because SDK might not export ToolDescription)
// ────────────────────────────────────────────────────────────────────────
interface ToolDescription {
  name: string;
  description: string;
  inputSchema: ZodTypeAny; // Use ZodTypeAny or a more specific Zod schema type
}

// ────────────────────────────────────────────────────────────────────────
// 1. Zod Schemas (defined once for validation)
// ────────────────────────────────────────────────────────────────────────
const vibeCheckSchema = z.object({
    plan: z.string(),
    userRequest: z.string(),
    thinkingLog: z.string().optional(),
    availableTools: z.array(z.string()).optional(),
    focusAreas: z.array(z.string()).optional(),
    sessionId: z.string().optional(),
    previousAdvice: z.string().optional(),
    phase: z.enum(["planning", "implementation", "review"]).optional(),
    confidence: z.number().optional()
}).required({ // Explicitly state required fields matching your TS interface
    plan: true,
    userRequest: true
});

const vibeDistillSchema = z.object({
    plan: z.string(),
    userRequest: z.string(),
    sessionId: z.string().optional()
}).required({
    plan: true,
    userRequest: true
});

const vibeLearnSchema = z.object({
    mistake: z.string(),
    category: z.string(),
    solution: z.string(),
    sessionId: z.string().optional()
}).required({
    mistake: true,
    category: true,
    solution: true
});

// ────────────────────────────────────────────────────────────────────────
// 2. Optional: Gemini Initialization
// ────────────────────────────────────────────────────────────────────────
try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
        initializeGemini(apiKey);
        console.error("[LOG] Gemini initialized.");
    } else {
        console.error("[WARN] GEMINI_API_KEY not set.");
    }
} catch (e) { console.error("[ERR] Gemini init failed:", e); }

// ────────────────────────────────────────────────────────────────────────
// 3. Server Instantiation (with capabilities)
// ────────────────────────────────────────────────────────────────────────
console.error("[LOG] Creating Server instance...");
const server = new Server({
  name: "vibe-check-mcp",
  version: "0.2.0", // Ensure this matches package.json
  capabilities: { tools: {} } // Add capabilities object as per transcript solution
});
console.error("[LOG] Server instance created.");

// ────────────────────────────────────────────────────────────────────────
// 4. Initialize Handler
// ────────────────────────────────────────────────────────────────────────
server.setRequestHandler(InitializeRequestSchema, async (req: InitializeRequest) => {
  console.error("[LOG] Received initialize request");
  const response = {
    protocolVersion: req.params.protocolVersion,
    serverInfo: { name: server.name, version: server.version },
    capabilities: { tools: {} } // Return capabilities
  };
  console.error("[LOG] Sending initialize response");
  return response;
});
console.error("[LOG] Initialize handler set.");

// ────────────────────────────────────────────────────────────────────────
// 5. tools/list Handler (using local ToolDescription type)
// ────────────────────────────────────────────────────────────────────────
const toolList: ToolDescription[] = [
  { name: "vibe_check",   description: "Metacognitive check for plan alignment and assumption testing.", inputSchema: vibeCheckSchema },
  { name: "vibe_distill", description: "Distills a plan to its essential core.", inputSchema: vibeDistillSchema },
  { name: "vibe_learn",   description: "Logs mistake patterns for future improvement.", inputSchema: vibeLearnSchema }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("[LOG] Received tools/list request");
  console.error("[LOG] Returning tool list:", JSON.stringify(toolList.map(t => t.name)));
  // Return structure matching SDK expectation for ListToolsResponse
  return { tools: toolList };
});
console.error("[LOG] tools/list handler set.");

// ────────────────────────────────────────────────────────────────────────
// 6. tools/call Handler (using Zod for internal validation)
// ────────────────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (req: CallToolRequest) => {
  const toolName = req.params.name;
  const rawArgs = req.params.arguments ?? {}; // Get raw arguments
  console.error(`[LOG] Received tools/call for: ${toolName}`);

  try {
    switch (toolName) {
      case 'vibe_check': {
        const args: VibeCheckInput = vibeCheckSchema.parse(rawArgs); // Validate/parse
        console.error(`[LOG] Executing: ${toolName}`);
        const result = await vibeCheckTool(args);
        console.error(`[LOG] Completed: ${toolName}`);
        return { content: [{ type: "text", text: result.questions + (result.patternAlert ? `\n\n**Pattern Alert:** ${result.patternAlert}`: "") }] };
      }
      case 'vibe_distill': {
        const args: VibeDistillInput = vibeDistillSchema.parse(rawArgs); // Validate/parse
        console.error(`[LOG] Executing: ${toolName}`);
        const result = await vibeDistillTool(args);
        console.error(`[LOG] Completed: ${toolName}`);
        return { content: [{ type: "markdown", markdown: result.distilledPlan + `\n\n**Rationale:** ${result.rationale}` }] };
      }
      case 'vibe_learn': {
        const args: VibeLearnInput = vibeLearnSchema.parse(rawArgs); // Validate/parse
        console.error(`[LOG] Executing: ${toolName}`);
        const result = await vibeLearnTool(args);
        console.error(`[LOG] Completed: ${toolName}`);
        type LearnCategorySummary = { category: string; count: number; recentExample: MistakeEntry }; // Local type helper
        const summary = result.topCategories.map((cat: LearnCategorySummary) => `- ${cat.category} (${cat.count})`).join('\n');
        return { content: [{ type: "text", text: `✅ Pattern logged. Tally for category: ${result.currentTally}.\nTop Categories:\n${summary}` }] };
      }
      default:
        console.error(`[ERR] Unknown tool requested: ${toolName}`);
        throw new Error(`Unknown tool "${toolName}"`);
    }
  } catch (error: any) {
    console.error(`[ERR] Error during tools/call for ${toolName}:`, error);
    if (error instanceof z.ZodError) {
      return { error: { code: "invalid_params", message: `Invalid arguments for ${toolName}: ${error.errors.map(e => e.message).join(', ')}` } };
    }
    return { error: { code: "tool_execution_error", message: `Error executing tool ${toolName}: ${error.message}` } };
  }
});
console.error("[LOG] tools/call handler set.");

// ────────────────────────────────────────────────────────────────────────
// 7. Transport Connection
// ────────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
console.error("[LOG] Connecting transport...");
(async () => {
  try {
    await server.connect(transport);
    console.error("[OK] vibe-check-mcp ready (stdio)");
  } catch (error) {
    console.error("[ERR] Fatal error connecting server:", error);
    process.exit(1);
  }
})();

// Optional: Add listeners for transport errors/close events
if (typeof transport.onclose === 'function' || typeof transport.onclose === 'undefined') {
    transport.onclose = () => {
        console.error("[LOG] Transport closed event received.");
    };
} else {
     console.error("[LOG] transport.onclose property not found or not assignable.");
}
