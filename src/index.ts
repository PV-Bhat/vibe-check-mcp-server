// src/index.ts --------------------------------------------------------------

// 1. core SDK classes
import { Server }                from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport }  from "@modelcontextprotocol/sdk/server/stdio.js";

// 2.  helper –– singular “tool.js”, not “tools.js”
import { tool } from "@modelcontextprotocol/sdk/server/tools-helpers.js";
// 3. misc deps
import { z }           from "zod";
import { vibeCheckTool,  VibeCheckInput  } from "./tools/vibeCheck.js";
import { vibeDistillTool, VibeDistillInput } from "./tools/vibeDistill.js";
import { vibeLearnTool,  VibeLearnInput  } from "./tools/vibeLearn.js";

// ──────────────────────────────────────────────────────────────
// create server
const server = new Server({
  name:         "vibe-check-mcp",
  version:      "0.2.0",
  capabilities: { tools: {} }          // makes initialise succeed
});

// register tools with the helper
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
       return { content: [{ type: "text",
                            text: r.questions + (r.patternAlert
                                   ? `\n\n**Pattern Alert:** ${r.patternAlert}`
                                   : "") }] };
     }
);

tool(server, "vibe_distill",
     { plan: z.string(), userRequest: z.string(), sessionId: z.string().optional() },
     async (args: VibeDistillInput) => {
       const r = await vibeDistillTool(args);
       return { content: [{ type: "markdown",
                            markdown: `${r.distilledPlan}\n\n**Rationale:** ${r.rationale}` }] };
     }
);

tool(server, "vibe_learn",
     { mistake: z.string(), category: z.string(),
       solution: z.string(), sessionId: z.string().optional() },
     async (args: VibeLearnInput) => {
       const r = await vibeLearnTool(args);
       const summary = r.topCategories
                        .map(c => `- ${c.category} (${c.count})`).join("\n");
       return { content: [{ type: "text",
                            text: `✅ Pattern logged (tally ${r.currentTally}).\nTop Categories:\n${summary}` }] };
     }
);

// connect via stdio
server.connect(new StdioServerTransport());
console.log("✅ Vibe‑Check MCP server ready.");
