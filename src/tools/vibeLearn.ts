#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z, ZodTypeAny } from "zod";

import { vibeCheckTool, VibeCheckInput, VibeCheckOutput } from "./tools/vibeCheck.js";
import { vibeDistillTool, VibeDistillInput, VibeDistillOutput } from "./tools/vibeDistill.js";
import { vibeLearnTool, VibeLearnInput, VibeLearnOutput } from "./tools/vibeLearn.js";

// Zod Schemas
const vibeCheckSchema = z.object({
  plan: z.string(),
  userRequest: z.string(),
  thinkingLog: z.string().optional(),
  availableTools: z.array(z.string()).optional(),
  focusAreas: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
  previousAdvice: z.string().optional(),
  phase: z.enum(["planning","implementation","review"]).optional(),
  confidence: z.number().optional()
}).strict();

const vibeDistillSchema = z.object({
  plan: z.string(),
  userRequest: z.string(),
  sessionId: z.string().optional()
}).strict();

const vibeLearnSchema = z.object({
  mistake: z.string(),
  category: z.string(),
  solution: z.string(),
  sessionId: z.string().optional()
}).strict();

// Server setup
type ToolDescription = { name: string; description: string; inputSchema: ZodTypeAny };
const SERVER_NAME = "vibe-check-mcp";
const SERVER_VERSION = "0.2.0";

console.error("[LOG] Initializing MCP server...");
const server = new Server({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  capabilities: { tools: {} }
});

// Initialize handler
server.setRequestHandler(InitializeRequestSchema, async (req) => {
  console.error("[LOG] Received initialize");
  return {
    protocolVersion: req.params.protocolVersion,
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    capabilities: { tools: {} }
  };
});

// List tools
const tools: ToolDescription[] = [
  { name: "vibe_check", description: "Metacognitive questioning tool", inputSchema: vibeCheckSchema },
  { name: "vibe_distill", description: "Distills a plan into concise steps", inputSchema: vibeDistillSchema },
  { name: "vibe_learn", description: "Logs and analyzes mistakes", inputSchema: vibeLearnSchema }
];
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("[LOG] Received tools/list");
  return { tools };
});

// Call tool
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const toolName = req.params.name;
  const rawArgs = req.params.arguments ?? {};
  console.error(`[LOG] Received tools/call for ${toolName}`);
  try {
    switch (toolName) {
      case "vibe_check": {
        const args = vibeCheckSchema.parse(rawArgs) as VibeCheckInput;
        const result = await vibeCheckTool(args);
        return {
          content: [
            { type: "text", text: result.questions + (result.patternAlert ? `\n\n**Pattern Alert:** ${result.patternAlert}` : "") }
          ]
        };
      }
      case "vibe_distill": {
        const args = vibeDistillSchema.parse(rawArgs) as VibeDistillInput;
        const result = await vibeDistillTool(args);
        return {
          content: [
            { type: "markdown", markdown: `${result.distilledPlan}\n\n**Rationale:** ${result.rationale}` }
          ]
        };
      }
      case "vibe_learn": {
        const args = vibeLearnSchema.parse(rawArgs) as VibeLearnInput;
        const result = await vibeLearnTool(args);
        const summary = result.topCategories
          .map(c => `- ${c.category} (${c.count})`)
          .join("\n");
        return {
          content: [
            { type: "text", text: `✅ Pattern logged. Tally: ${result.currentTally}.\nTop Categories:\n${summary}` }
          ]
        };
      }
      default:
        console.error(`[ERR] Unknown tool: ${toolName}`);
        return { error: { code: "tool_not_found", message: `Unknown tool \"${toolName}\"` } };
    }
  } catch (err: any) {
    console.error(`[ERR] Error in ${toolName}:`, err);
    if (err instanceof z.ZodError) {
      return { error: { code: "invalid_params", message: err.errors.map(e => e.message).join(", ") } };
    }
    return { error: { code: "tool_execution_error", message: err.message || String(err) } };
  }
});

// Transport connection
const transport = new StdioServerTransport();
console.error("[LOG] Connecting transport...");
(async () => {
  try {
    await server.connect(transport);
    console.error("[OK] Server ready (stdio)");
  } catch (err: any) {
    console.error("[FATAL] Could not connect server:", err);
    process.exit(1);
  }
})();

// Handle transport close
type OnClose = () => void;
(transport as any).onclose = (() => {
  console.error("[LOG] Transport closed");
}) as OnClose;
