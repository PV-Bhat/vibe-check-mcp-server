// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  CallToolRequest,
  ToolDescription
} from "@modelcontextprotocol/sdk/types.js";

import { z } from "zod";

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

// ──────────────── 1.  Zod schemas (single source of truth) ────────────────
const vibeCheckSchema = z.object({
  plan:        z.string(),
  userRequest: z.string(),
  thinkingLog: z.string().optional(),
  phase:       z.enum(["planning", "implementation", "review"]).optional()
});

const vibeDistillSchema = z.object({
  plan:        z.string(),
  userRequest: z.string()
});

const vibeLearnSchema  = z.object({
  mistake:  z.string(),
  category: z.string(),
  solution: z.string()
});

// ──────────────── 2.  Gemini (optional) ────────────────
if (process.env.GEMINI_API_KEY) {
  try {
    // initializeGemini(process.env.GEMINI_API_KEY);          // <- your helper
    console.error("[LOG] Gemini initialised");
  } catch (e) {
    console.error("[ERR] Gemini init failed:", e);
  }
} else {
  console.error("[WARN] GEMINI_API_KEY not set – Gemini tools will fail");
}

// ──────────────── 3.  Server with tools capability ────────────────
const server = new Server({
  name:         "vibe-check-mcp",
  version:      "0.2.0",
  capabilities: { tools: {} }          // <- informs SDK we handle tools/*
});

// ──────────────── 4.  tools/list handler ────────────────
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

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolList }));

// ──────────────── 5.  tools/call dispatcher ────────────────
server.setRequestHandler(
  CallToolRequestSchema,
  async (req: CallToolRequest) => {
    const { name, arguments: raw = {} } = req.params;

    switch (name) {
      case "vibe_check": {
        const args: VibeCheckInput = vibeCheckSchema.parse(raw);
        const out:  VibeCheckOutput = await vibeCheckTool(args);
        return {
          content: [{
            type: "text",
            text: out.questions +
                 (out.patternAlert ? `\n\n**Pattern Alert:** ${out.patternAlert}` : "")
          }]
        };
      }

      case "vibe_distill": {
        const args: VibeDistillInput = vibeDistillSchema.parse(raw);
        const out:  VibeDistillOutput = await vibeDistillTool(args);
        return {
          content: [{
            type:     "markdown",
            markdown: `${out.distilledPlan}\n\n**Rationale:** ${out.rationale}`
          }]
        };
      }

      case "vibe_learn": {
        const args: VibeLearnInput = vibeLearnSchema.parse(raw);
        const out:  VibeLearnOutput = await vibeLearnTool(args);
        const summary = out.topCategories
                           .map(c => `- ${c.category} (${c.count})`)
                           .join("\n");
        return {
          content: [{
            type: "text",
            text: `✅ Logged. Current tally: ${out.currentTally}\n\n${summary}`
          }]
        };
      }

      default:
        throw new Error(`Unknown tool "${name}"`);
    }
  }
);

// ──────────────── 6.  STDIO transport ────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[OK] vibe‑check‑mcp ready (stdio)");
