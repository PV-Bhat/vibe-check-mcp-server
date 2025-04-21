// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  InitializeRequest, // Keep if needed for typing 'req' in initialize handler
  CallToolRequest
} from "@modelcontextprotocol/sdk/types.js";
import { z, ZodTypeAny } from "zod"; // Import ZodTypeAny

import {
  vibeCheckTool,
  VibeCheckInput,
  VibeCheckOutput
} from "./tools/vibeCheck.js";
import {
  vibeDistillTool,
  VibeDistillInput,
  VibeDistillOutput
} from "./tools/vibeDistill.js";
import {
  vibeLearnTool,
  VibeLearnInput,
  VibeLearnOutput
} from "./tools/vibeLearn.js";
import { initializeGemini } from "./utils/gemini.js"; // Assuming gemini utils are needed

console.error("[LOG] MCP Server: Script starting...");

// ────────────────────────────────
// 0. Local helper type (since SDK doesn't export ToolDescription reliably)
// ────────────────────────────────
interface ToolDescription {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny; // Use ZodTypeAny for flexibility
}

// ────────────────────────────────
// 1. Zod schemas (one source of truth)
// ────────────────────────────────
const vibeCheckSchema = z.object({
  plan:        z.string(),
  userRequest: z.string(),
  thinkingLog: z.string().optional(),
  phase:       z.enum(["planning","implementation","review"]).optional(),
  // Add back other optional fields from VibeCheckInput if needed by schema/tool
  availableTools: z.array(z.string()).optional(),
  focusAreas:     z.array(z.string()).optional(),
  sessionId:      z.string().optional(),
  previousAdvice: z.string().optional(),
  confidence:     z.number().optional()
}).required({ // Ensure required fields match VibeCheckInput
    plan: true,
    userRequest: true
});

const vibeDistillSchema = z.object({
  plan:        z.string(),
  userRequest: z.string(),
  sessionId:   z.string().optional() // Added optional sessionId
}).required({
    plan: true,
    userRequest: true
});

const vibeLearnSchema  = z.object({
  mistake:  z.string(),
  category: z.string(),
  solution: z.string(),
  sessionId: z.string().optional() // Added optional sessionId
}).required({
    mistake: true,
    category: true,
    solution: true
});

// ────────────────────────────────
// 2. Gemini (optional)
// ────────────────────────────────
if (process.env.GEMINI_API_KEY) {
  try {
    initializeGemini(process.env.GEMINI_API_KEY); // Use your helper
    console.error("[LOG] Gemini initialised");
  } catch (e) {
    console.error("[ERR] Gemini init failed:", e);
  }
} else {
  console.error("[WARN] GEMINI_API_KEY not set – Gemini-based tools will fail");
}

// ────────────────────────────────
// 3. Server with “tools” capability
// ────────────────────────────────
const server = new Server({
  name:         "vibe-check-mcp",
  version:      "0.2.0",
  capabilities: { tools: {} } // Essential for enabling tool handling
});
console.error("[LOG] Server instance created.");

// ────────────────────────────────
// 4. initialize handler (Important: Use Schema here, not string)
// ────────────────────────────────
server.setRequestHandler(InitializeRequestSchema, async (req: InitializeRequest) => {
    console.error("[LOG] Received initialize request");
    const response = {
        protocolVersion: req.params.protocolVersion,
        serverInfo: { name: "vibe-check-mcp", version: "0.2.0" },
        capabilities: { tools: {} } // Echo back capabilities
    };
    console.error("[LOG] Sending initialize response");
    return response;
});
console.error("[LOG] Initialize handler set.");

// ────────────────────────────────
// 5. tools/list handler -> static descriptors using local type
// ────────────────────────────────
const toolList: ToolDescription[] = [
  {
    name: "vibe_check",
    description: "Metacognitive check for plan alignment and assumption testing.",
    inputSchema: vibeCheckSchema
  },
  {
    name: "vibe_distill",
    description: "Distils a plan to its essential core.",
    inputSchema: vibeDistillSchema
  },
  {
    name: "vibe_learn",
    description: "Logs mistake patterns for future improvement.",
    inputSchema: vibeLearnSchema
  }
];
server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error("[LOG] Received tools/list request");
    console.error("[LOG] Returning tool list:", JSON.stringify(toolList.map(t=>t.name)));
    return { tools: toolList };
});
console.error("[LOG] tools/list handler set.");

// ────────────────────────────────
// 6. tools/call dispatcher -> uses Zod schemas for parsing
// ────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (req: CallToolRequest) => {
  const { name, arguments: raw = {} } = req.params;
  console.error(`[LOG] Received tools/call request for: ${name}`);

  try {
      switch (name) {
        case "vibe_check": {
          const args: VibeCheckInput = vibeCheckSchema.parse(raw); // Use Zod to parse/validate
          console.error(`[LOG] Executing vibe_check tool...`);
          const out: VibeCheckOutput = await vibeCheckTool(args);
          console.error(`[LOG] vibe_check tool executed.`);
          return {
            content: [{
              type: "text",
              text: out.questions + (out.patternAlert ? `\n\n**Pattern Alert:** ${out.patternAlert}` : "")
            }]
          };
        }

        case "vibe_distill": {
          const args: VibeDistillInput = vibeDistillSchema.parse(raw); // Use Zod to parse/validate
          console.error(`[LOG] Executing vibe_distill tool...`);
          const out: VibeDistillOutput = await vibeDistillTool(args);
           console.error(`[LOG] vibe_distill tool executed.`);
          return {
            content: [{
              type: "markdown",
              markdown: `${out.distilledPlan}\n\n**Rationale:** ${out.rationale}`
            }]
          };
        }

        case "vibe_learn": {
          const args: VibeLearnInput = vibeLearnSchema.parse(raw); // Use Zod to parse/validate
          console.error(`[LOG] Executing vibe_learn tool...`);
          const out: VibeLearnOutput = await vibeLearnTool(args);
           console.error(`[LOG] vibe_learn tool executed.`);
          // Type helper needed if using 'map' on potentially complex object
           type LearnCategorySummary = { category: string; count: number; recentExample: MistakeEntry };
           const summary = out.topCategories.map((c: LearnCategorySummary) => `- ${c.category} (${c.count})`).join("\n");
           return {
             content: [{
               type: "text",
               text: `✅ Logged. Current tally: ${out.currentTally}\n\nTop Categories:\n${summary}`
             }]
           };
         }

        default:
          console.error(`[ERR] Unknown tool requested: ${name}`);
          throw new Error(`Unknown tool "${name}"`);
       }
  } catch (error: any) {
        console.error(`[ERR] Error during tools/call for ${name}:`, error);
        // Handle Zod validation errors specifically if needed
        if (error instanceof z.ZodError) {
             return { error: { code: "invalid_params", message: `Invalid arguments for ${name}: ${error.errors.map(e=>e.message).join(', ')}` } };
        }
        return { error: { code: "tool_execution_error", message: `Error executing tool ${name}: ${error.message}` } };
  }
});
console.error("[LOG] tools/call handler set.");

// ────────────────────────────────
// 7. STDIO transport hookup
// ────────────────────────────────
const transport = new StdioServerTransport();
console.error("[LOG] Connecting transport...");
// Wrap connect in an async IIFE as it's likely async
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
if (transport.onclose) {
    transport.onclose = () => {
        console.error("[LOG] Transport closed event received.");
    };
}
