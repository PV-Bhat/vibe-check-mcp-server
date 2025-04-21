// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  CallToolRequest,
  ListToolsResponse,
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

// ───────────────────────────────────────────────────────────
// 1   Gemini (optional)
// ───────────────────────────────────────────────────────────
try {
  if (process.env.GEMINI_API_KEY) {
    // your initializeGemini(...) helper here
    console.error("[LOG] Gemini initialised");
  } else {
    console.error("[WARN] GEMINI_API_KEY not set – Gemini‑based tools will fail");
  }
} catch (err) {
  console.error("[ERR ] Gemini init failed:", err);
}

// ───────────────────────────────────────────────────────────
// 2   Create Server  (+ declare “tools” capability)
// ───────────────────────────────────────────────────────────
const server = new Server({
  name:    "vibe-check-mcp",
  version: "0.2.0",
  capabilities: { tools: {} }          // ← ■■■ IMPORTANT ■■■
});

// ───────────────────────────────────────────────────────────
// 3   tools/list  → return static descriptors
// ───────────────────────────────────────────────────────────
const toolList: ListToolsResponse["tools"] = [
  {
    name: "vibe_check",
    description: "Metacognitive check for plan alignment and assumption testing.",
    inputSchema: z.object({
      plan:        z.string(),
      userRequest: z.string(),
      thinkingLog: z.string().optional(),
      phase:       z.enum(["planning","implementation","review"]).optional()
    })
  },
  {
    name: "vibe_distill",
    description: "Distils a plan to its essential core.",
    inputSchema: z.object({
      plan:        z.string(),
      userRequest: z.string()
    })
  },
  {
    name: "vibe_learn",
    description: "Logs mistake patterns for future improvement.",
    inputSchema: z.object({
      mistake:  z.string(),
      category: z.string(),
      solution: z.string()
    })
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolList }));

// ───────────────────────────────────────────────────────────
// 4   tools/call  → dispatch to real implementations
// ───────────────────────────────────────────────────────────
server.setRequestHandler(
  CallToolRequestSchema,
  async (req: CallToolRequest) => {
    const { name, arguments: argsRaw = {} } = req.params;

    switch (name) {
      case "vibe_check": {
        const args = argsRaw as VibeCheckInput;
        const out: VibeCheckOutput = await vibeCheckTool(args);
        return {
          content: [{
            type: "text",
            text: out.questions +
                 (out.patternAlert ? `\n\n**Pattern Alert:** ${out.patternAlert}` : "")
          }]
        };
      }

      case "vibe_distill": {
        const args = argsRaw as VibeDistillInput;
        const out: VibeDistillOutput = await vibeDistillTool(args);
        return {
          content: [{
            type:     "markdown",
            markdown: `${out.distilledPlan}\n\n**Rationale:** ${out.rationale}`
          }]
        };
      }

      case "vibe_learn": {
        const args = argsRaw as VibeLearnInput;
        const out: VibeLearnOutput = await vibeLearnTool(args);
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

// ───────────────────────────────────────────────────────────
// 5   STDIO transport hookup
// ───────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[OK ] vibe‑check‑mcp ready (stdio)");
