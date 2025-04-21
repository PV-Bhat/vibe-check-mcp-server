#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  InitializeRequest,
  CallToolRequest
} from "@modelcontextprotocol/sdk/types.js";
import { z, ZodTypeAny } from "zod";

import { vibeCheckTool, VibeCheckInput, VibeCheckOutput } from "./tools/vibeCheck.js";
import { vibeDistillTool, VibeDistillInput, VibeDistillOutput } from "./tools/vibeDistill.js";
import { vibeLearnTool, VibeLearnInput, VibeLearnOutput } from "./tools/vibeLearn.js";
import { initializeGemini } from "./utils/gemini.js";
import { MistakeEntry } from "./utils/storage.js";

console.error("[LOG] MCP Server: Script starting...");

// ────────────────────────────────────────────────────────────────────────
// 0. Local helper type
// ────────────────────────────────────────────────────────────────────────
interface ToolDescription {
  name: string;
  description: string;
  inputSchema: ZodTypeAny;
}

// ────────────────────────────────────────────────────────────────────────
// 1. Zod Schemas
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
}).required({ plan: true, userRequest: true });

const vibeDistillSchema = z.object({
  plan: z.string(),
  userRequest: z.string(),
  sessionId: z.string().optional()
}).required({ plan: true, userRequest: true });

const vibeLearnSchema = z.object({
  mistake: z.string(),
  category: z.string(),
  solution: z.string(),
  sessionId: z.string().optional()
}).required({ mistake: true, category: true, solution: true });

// ────────────────────────────────────────────────────────────────────────
// 2. Deferred Gemini initialization
// ────────────────────────────────────────────────────────────────────────
console.error("[LOG] Starting async Gemini initialization...");
const geminiInit = initializeGemini()
  .then(() => console.error("[OK] Gemini initialized"))
  .catch(err => console.error("[ERR] Gemini initialization failed:", err));

// ────────────────────────────────────────────────────────────────────────
// Constants for server info
// ────────────────────────────────────────────────────────────────────────
const SERVER_NAME = "vibe-check-mcp";
const SERVER_VERSION = "0.2.0";

// ────────────────────────────────────────────────────────────────────────
// 3. Server Instantiation
// ────────────────────────────────────────────────────────────────────────
console.error("[LOG] Creating Server instance...");
const server = new Server({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  capabilities: { tools: {} }
});
console.error("[LOG] Server instance created.");

// ────────────────────────────────────────────────────────────────────────
// 4. Initialize handler
// ────────────────────────────────────────────────────────────────────────
server.setRequestHandler(InitializeRequestSchema, async (req: InitializeRequest) => {
  console.error("[LOG] Received initialize request");
  return {
    protocolVersion: req.params.protocolVersion,
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    capabilities: { tools: {} }
  };
});
console.error("[LOG] Initialize handler set.");

// ────────────────────────────────────────────────────────────────────────
// 5. tools/list Handler
// ────────────────────────────────────────────────────────────────────────
const toolList: ToolDescription[] = [
  { name: "vibe_check", description: "Metacognitive check...", inputSchema: vibeCheckSchema },
  { name: "vibe_distill", description: "Distills a plan...", inputSchema: vibeDistillSchema },
  { name: "vibe_learn", description: "Logs mistake patterns...", inputSchema: vibeLearnSchema }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("[LOG] Received tools/list request");
  return { tools: toolList };
});
console.error("[LOG] tools/list handler set.");

// ────────────────────────────────────────────────────────────────────────
// 6. tools/call Handler
// ────────────────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (req: CallToolRequest) => {
  await geminiInit;  // ensure Gemini is ready before any tool runs
  const toolName = req.params.name;
  const rawArgs = req.params.arguments ?? {};
  console.error(`[LOG] Received tools/call for: ${toolName}`);

  try {
    switch (toolName) {
      case 'vibe_check': {
        const args = vibeCheckSchema.parse(rawArgs);
        console.error(`[LOG] Executing: ${toolName}`);
        const result = await vibeCheckTool(args);
        console.error(`[LOG] Completed: ${toolName}`);
        return { content: [{ type: "text", text: result.questions + (result.patternAlert ? `\n\n**Pattern Alert:** ${result.patternAlert}` : "") }] };
      }
      case 'vibe_distill': {
        const args = vibeDistillSchema.parse(rawArgs);
        console.error(`[LOG] Executing: ${toolName}`);
        const result = await vibeDistillTool(args);
        console.error(`[LOG] Completed: ${toolName}`);
        return { content: [{ type: "markdown", markdown: result.distilledPlan + `\n\n**Rationale:** ${result.rationale}` }] };
      }
      case 'vibe_learn': {
        const args = vibeLearnSchema.parse(rawArgs);
        console.error(`[LOG] Executing: ${toolName}`);
        const result = await vibeLearnTool(args);
        console.error(`[LOG] Completed: ${toolName}`);
        const summary = result.topCategories.map((cat: any) => `- ${cat.category} (${cat.count})`).join('\n');
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
console.error("[LOG] Connecting transport...");
const transport = new StdioServerTransport();
(async () => {
  try {
    await server.connect(transport);
    console.error(`[OK] ${SERVER_NAME} v${SERVER_VERSION} ready (stdio)`);
  } catch (error) {
    console.error("[ERR] Fatal error connecting server:", error);
    process.exit(1);
  }
})();

transport.onclose = () => {
  console.error("[LOG] Transport closed event received.");
};
