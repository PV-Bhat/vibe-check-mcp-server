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

// ────────────────────────────────────────────────────────────────────────
// Entry-point logging
// ────────────────────────────────────────────────────────────────────────
console.error("[LOG] MCP Server: Script starting...");

// ────────────────────────────────────────────────────────────────────────
// 0. Helper type for listing tools
// ────────────────────────────────────────────────────────────────────────
interface ToolDescription {
  name: string;
  description: string;
  inputSchema: ZodTypeAny;
}

// ────────────────────────────────────────────────────────────────────────
// 1. Zod Schemas for tool inputs
// ────────────────────────────────────────────────────────────────────────
const vibeCheckSchema = z
  .object({
    plan: z.string(),
    userRequest: z.string(),
    thinkingLog: z.string().optional(),
    availableTools: z.array(z.string()).optional(),
    focusAreas: z.array(z.string()).optional(),
    sessionId: z.string().optional(),
    previousAdvice: z.string().optional(),
    phase: z.enum(["planning", "implementation", "review"]).optional(),
    confidence: z.number().optional()
  })
  .required({ plan: true, userRequest: true });

const vibeDistillSchema = z
  .object({
    plan: z.string(),
    userRequest: z.string(),
    sessionId: z.string().optional()
  })
  .required({ plan: true, userRequest: true });

const vibeLearnSchema = z
  .object({
    mistake: z.string(),
    category: z.string(),
    solution: z.string(),
    sessionId: z.string().optional()
  })
  .required({ mistake: true, category: true, solution: true });

// ────────────────────────────────────────────────────────────────────────
// 2. Initialize Gemini (non-blocking)
// ────────────────────────────────────────────────────────────────────────
try {
  const apiKey = process.env.GEMINI_API_KEY || "";
  initializeGemini(apiKey);
  console.error("[LOG] Gemini initialized");
} catch (err: unknown) {
  console.error("[ERR] Gemini init failed", err);
}

// ────────────────────────────────────────────────────────────────────────
// 3. Server metadata and instantiation
// ────────────────────────────────────────────────────────────────────────
const SERVER_NAME = "vibe-check-mcp";
const SERVER_VERSION = "0.2.0"; // match package.json

console.error("[LOG] Creating Server instance...");
const server = new Server({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  capabilities: { tools: {} }
});
console.error("[LOG] Server instance created.");

// ────────────────────────────────────────────────────────────────────────
// 4. Handle initialize/handshake
// ────────────────────────────────────────────────────────────────────────
server.setRequestHandler(
  InitializeRequestSchema,
  async (req: InitializeRequest) => {
    console.error("[LOG] Received initialize request");
    const resp = {
      protocolVersion: req.params.protocolVersion,
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      capabilities: { tools: {} }
    };
    console.error("[LOG] Sending initialize response");
    return resp;
  }
);
console.error("[LOG] Initialize handler set.");

// ────────────────────────────────────────────────────────────────────────
// 5. tools/list — advertise available tools
// ────────────────────────────────────────────────────────────────────────
const toolList: ToolDescription[] = [
  { name: "vibe_check", description: "Metacognitive check for user plans", inputSchema: vibeCheckSchema },
  { name: "vibe_distill", description: "Distills a plan into concise steps", inputSchema: vibeDistillSchema },
  { name: "vibe_learn", description: "Logs and summarizes mistake patterns", inputSchema: vibeLearnSchema }
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("[LOG] Received tools/list request");
  return { tools: toolList };
});
console.error("[LOG] tools/list handler set.");

// ────────────────────────────────────────────────────────────────────────
// 6. tools/call — dispatch incoming tool invocations
// ────────────────────────────────────────────────────────────────────────
server.setRequestHandler(
  CallToolRequestSchema,
  async (req: CallToolRequest) => {
    const toolName = req.params.name;
    const rawArgs = req.params.arguments ?? {};
    console.error(`[LOG] Received tools/call for: ${toolName}`);

    try {
      switch (toolName) {
        case "vibe_check": {
          const args = vibeCheckSchema.parse(rawArgs) as VibeCheckInput;
          console.error(`[LOG] Executing: ${toolName}`);
          const result = await vibeCheckTool(args);
          console.error(`[LOG] Completed: ${toolName}`);
          return {
            content: [{
              type: "text",
              text:
                result.questions +
                (result.patternAlert ? `\n\n**Pattern Alert:** ${result.patternAlert}` : "")
            }]
          };
        }

        case "vibe_distill": {
          const args = vibeDistillSchema.parse(rawArgs) as VibeDistillInput;
          console.error(`[LOG] Executing: ${toolName}`);
          const result = await vibeDistillTool(args);
          console.error(`[LOG] Completed: ${toolName}`);
          return {
            content: [{ type: "markdown", markdown: result.distilledPlan + `\n\n**Rationale:** ${result.rationale}` }]
          };
        }

        case "vibe_learn": {
          const args = vibeLearnSchema.parse(rawArgs) as VibeLearnInput;
          console.error(`[LOG] Executing: ${toolName}`);
          const result = await vibeLearnTool(args);
          console.error(`[LOG] Completed: ${toolName}`);
          type LearnCategorySummary = { category: string; count: number; recentExample: MistakeEntry };
          const summary = result.topCategories
            .map((cat: LearnCategorySummary) => `- ${cat.category} (${cat.count})`)
            .join("\n");
          return {
            content: [{
              type: "text",
              text: `✅ Pattern logged. Tally for category: ${result.currentTally}.\nTop Categories:\n${summary}`
            }]
          };
        }

        default:
          console.error(`[ERR] Unknown tool requested: ${toolName}`);
          throw new Error(`Unknown tool "${toolName}"`);
      }
    } catch (error: unknown) {
      console.error(`[ERR] Error during tools/call for ${toolName}:`, error);
      if (error instanceof z.ZodError) {
        return { error: { code: "invalid_params", message: `Invalid args for ${toolName}: ${error.errors.map(e => e.message).join(", ")}` } };
      }
      const msg = error instanceof Error ? error.message : String(error);
      return { error: { code: "tool_execution_error", message: `Error executing ${toolName}: ${msg}` } };
    }
  }
);
console.error("[LOG] tools/call handler set.");

// ────────────────────────────────────────────────────────────────────────
// 7. Connect transport (stdio)
// ────────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
console.error("[LOG] Connecting transport...");
(async () => {
  try {
    await server.connect(transport);
    console.error("[OK] vibe-check-mcp ready (stdio)");
  } catch (err) {
    console.error("[ERR] Fatal error connecting server:", err);
    process.exit(1);
  }
})();

// Optional transport close handler
if (typeof transport.onclose === 'function') {
  transport.onclose = () => console.error("[LOG] Transport closed event received.");
} else {
  console.error("[LOG] transport.onclose property not found or not assignable.");
}
