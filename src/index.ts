// ────────────────────────────────────────────────────────────
//  src/index.ts   (TypeScript >= 5.3, Node ≥ 18, ESM 'type':module)
// ────────────────────────────────────────────────────────────

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Your domain logic (already written)
import { vibeCheckTool,  VibeCheckInput  } from "./tools/vibeCheck.js";
import { vibeDistillTool, VibeDistillInput } from "./tools/vibeDistill.js";
import { vibeLearnTool,  VibeLearnInput  } from "./tools/vibeLearn.js";

// ───────── 1. create the MCP server ─────────
const server = new Server({
  name:         "vibe-check-mcp",
  version:      "0.2.0",
  capabilities: { tools: {} }          // ← advertises that we support tools
});

// Helper to wrap plain‑text results
const text  = (txt: string) => ({ type: "text", text: txt });
const md    = (md : string) => ({ type: "markdown", markdown: md });

// ───────── 2. vibe_check ─────────
server.tool(
  "vibe_check",

  // NOTE: pass **shape**, not z.object()
  {
    plan:           z.string(),
    userRequest:    z.string(),

    thinkingLog:    z.string().optional(),
    availableTools: z.array(z.string()).optional(),
    focusAreas:     z.array(z.string()).optional(),
    sessionId:      z.string().optional(),
    previousAdvice: z.string().optional(),
    phase:          z.enum(["planning","implementation","review"]).optional(),
    confidence:     z.number().optional()
  },

  // handler
  async (args: VibeCheckInput) => {
    const r = await vibeCheckTool(args);
    return {
      content: [ text(r.questions + (r.patternAlert ? `\n\n**Pattern Alert:** ${r.patternAlert}` : "")) ]
    };
  }
);

// ───────── 3. vibe_distill ─────────
server.tool(
  "vibe_distill",
  {
    plan:        z.string(),
    userRequest: z.string(),
    sessionId:   z.string().optional()
  },
  async (args: VibeDistillInput) => {
    const r = await vibeDistillTool(args);
    return { content: [ md(`${r.distilledPlan}\n\n**Rationale:** ${r.rationale}`) ] };
  }
);

// ───────── 4. vibe_learn ─────────
server.tool(
  "vibe_learn",
  {
    mistake:  z.string(),
    category: z.string(),
    solution: z.string(),
    sessionId:z.string().optional()
  },
  async (args: VibeLearnInput) => {
    const r = await vibeLearnTool(args);
    const summary = r.topCategories.map(c => `- ${c.category} (${c.count})`).join("\n");
    return {
      content: [ text(`✅ Pattern logged (tally ${r.currentTally}).\nTop Categories:\n${summary}`) ]
    };
  }
);

// ───────── 5. connect transport ─────────
server.connect(new StdioServerTransport());

console.log("✅ Vibe‑Check MCP server ready (STDIO).");
