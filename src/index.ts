// src/index.ts --------------------------------------------------------------

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { tool } from "@modelcontextprotocol/sdk/server/tools.js";   // <- NEW
import { z } from "zod";

// your existing helpers
import { vibeCheckTool,  VibeCheckInput  } from "./tools/vibeCheck.js";
import { vibeDistillTool, VibeDistillInput } from "./tools/vibeDistill.js";
import { vibeLearnTool,  VibeLearnInput  } from "./tools/vibeLearn.js";

// ──────────────────────────────────────────────────────────────
// 1. create server (advertise tools capability so init succeeds)
const server = new Server({
  name:         "vibe-check-mcp",
  version:      "0.2.0",
  capabilities: { tools: {} }
});

// convenience helpers
const text = (t: string) => ({ type: "text", text: t });
const md   = (m: string) => ({ type: "markdown", markdown: m });

// ──────────────────────────────────────────────────────────────
// 2. register tools ‑‑ use *function* tool(server,...)
tool(server, "vibe_check",
  {
    plan:        z.string(),
    userRequest: z.string(),
    thinkingLog: z.string().optional(),
    availableTools: z.array(z.string()).optional(),
    focusAreas:     z.array(z.string()).optional(),
    sessionId:      z.string().optional(),
    previousAdvice: z.string().optional(),
    phase:          z.enum(["planning","implementation","review"]).optional(),
    confidence:     z.number().optional()
  },
  async (args: VibeCheckInput) => {
    const r = await vibeCheckTool(args);
    return { content: [text(r.questions + (r.patternAlert ? `\n\n**Pattern Alert:** ${r.patternAlert}` : ""))] };
  }
);

tool(server, "vibe_distill",
  {
    plan:        z.string(),
    userRequest: z.string(),
    sessionId:   z.string().optional()
  },
  async (args: VibeDistillInput) => {
    const r = await vibeDistillTool(args);
    return { content: [md(`${r.distilledPlan}\n\n**Rationale:** ${r.rationale}`)] };
  }
);

tool(server, "vibe_learn",
  {
    mistake:  z.string(),
    category: z.string(),
    solution: z.string(),
    sessionId:z.string().optional()
  },
  async (args: VibeLearnInput) => {
    const r = await vibeLearnTool(args);
    const summary = r.topCategories.map(c => `- ${c.category} (${c.count})`).join("\n");
    return { content: [text(`✅ Pattern logged (tally ${r.currentTally}).\nTop Categories:\n${summary}`)] };
  }
);

// ──────────────────────────────────────────────────────────────
// 3. connect STDIO transport
server.connect(new StdioServerTransport());

console.log("✅ Vibe‑Check MCP server ready.");
