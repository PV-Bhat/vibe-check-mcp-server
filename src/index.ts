// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { vibeCheckTool  } from "./tools/vibeCheck.js";
import { vibeDistillTool } from "./tools/vibeDistill.js";
import { vibeLearnTool   } from "./tools/vibeLearn.js";

// ────────────────────────────────────────────────────────────
// 1. start Gemini (if you need it)
// ────────────────────────────────────────────────────────────
const key = process.env.GEMINI_API_KEY;
if (!key) console.error("[WARN] GEMINI_API_KEY not set – tools that call Gemini will fail");

// ────────────────────────────────────────────────────────────
// 2. create server + transport
// ────────────────────────────────────────────────────────────
const server    = new Server({ name: "vibe-check-mcp", version: "0.2.0" });
const transport = new StdioServerTransport();

// ────────────────────────────────────────────────────────────
// 3. register tools – each call automatically wires‑up
//    tools/list  +  tools/call
// ────────────────────────────────────────────────────────────
server.tool(
  "vibe_check",
  z.object({
    plan:        z.string(),
    userRequest: z.string(),
    thinkingLog: z.string().optional(),
    phase:       z.enum(["planning","implementation","review"]).optional(),
  }),
  async args => {
    /* TODO – your existing vibeCheckTool wrapper */
    const out = await vibeCheckTool(args);
    return {
      content: [{
        type : "text",
        text : out.questions +
              (out.patternAlert ? `\n\n**Pattern Alert:** ${out.patternAlert}` : "")
      }]
    };
  }
);

server.tool(
  "vibe_distill",
  z.object({
    plan:        z.string(),
    userRequest: z.string(),
  }),
  async args => {
    /* TODO – your existing vibeDistillTool wrapper */
    const out = await vibeDistillTool(args);
    return {
      content: [{
        type    : "markdown",
        markdown: `${out.distilledPlan}\n\n**Why:** ${out.rationale}`
      }]
    };
  }
);

server.tool(
  "vibe_learn",
  z.object({
    mistake : z.string(),
    category: z.string(),
    solution: z.string(),
  }),
  async args => {
    /* TODO – your existing vibeLearnTool wrapper */
    const out = await vibeLearnTool(args);
    const list = out.topCategories
                    .map(c => `- ${c.category} (${c.count})`).join("\n");
    return {
      content: [{
        type : "text",
        text : `✅ Logged.  Current tally: ${out.currentTally}\n${list}`
      }]
    };
  }
);

// ────────────────────────────────────────────────────────────
// 4. go live
// ────────────────────────────────────────────────────────────
await server.connect(transport);
console.error("[OK] vibe‑check‑mcp is ready (stdio)");
