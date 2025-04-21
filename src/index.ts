// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { tools }  from "@modelcontextprotocol/sdk/server/tools";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { vibeCheckTool,   VibeCheckInput   } from "./tools/vibeCheck.js";
import { vibeDistillTool, VibeDistillInput } from "./tools/vibeDistill.js";
import { vibeLearnTool,   VibeLearnInput   } from "./tools/vibeLearn.js";
import { initializeGemini } from "./utils/gemini.js";

(async () => {
  console.error("MCP Server: Starting…");

  // — init Gemini if you have an API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("MCP Server: ⚠️ GEMINI_API_KEY not set; tools may fail");
  } else {
    try {
      initializeGemini(apiKey);
      console.error("MCP Server: Gemini initialized");
    } catch (e) {
      console.error("MCP Server: Error initializing Gemini:", e);
    }
  }

  // — create the lean base server…
  const base   = new Server({ name: "vibe-check-mcp", version: "0.2.0" });
  // — …then enhance it with tools support
  const server = tools(base);

  // — register your tools…

  server.tool(
    "vibe_check",
    z
      .object({
        plan:        z.string(),
        userRequest: z.string(),
        thinkingLog: z.string().optional(),
        phase:       z.enum(["planning","implementation","review"]).optional(),
      })
      .required({ plan: true, userRequest: true }),
    async (args: VibeCheckInput) => {
      console.error("MCP Server: running vibe_check…");
      const out = await vibeCheckTool(args);
      return {
        content: [{
          type: "text",
          text:  out.questions +
                 (out.patternAlert
                    ? `\n\n**Pattern Alert:** ${out.patternAlert}`
                    : "")
        }]
      };
    }
  );

  server.tool(
    "vibe_distill",
    z
      .object({
        plan:        z.string(),
        userRequest: z.string(),
      })
      .required({ plan: true, userRequest: true }),
    async (args: VibeDistillInput) => {
      console.error("MCP Server: running vibe_distill…");
      const out = await vibeDistillTool(args);
      return {
        content: [{
          type:     "markdown",
          markdown: `${out.distilledPlan}\n\n**Rationale:** ${out.rationale}`
        }]
      };
    }
  );

  server.tool(
    "vibe_learn",
    z
      .object({
        mistake:  z.string(),
        category: z.string(),
        solution: z.string(),
      })
      .required({ mistake: true, category: true, solution: true }),
    async (args: VibeLearnInput) => {
      console.error("MCP Server: running vibe_learn…");
      const out = await vibeLearnTool(args);
      const summary = out.topCategories
        .map(c => `- ${c.category} (${c.count})`)
        .join("\n");
      return {
        content: [{
          type: "text",
          text:  `✅ Logged. Current tally: ${out.currentTally}\n\n${summary}`
        }]
      };
    }
  );

  // — wire up STDIO transport
  console.error("MCP Server: connecting transport…");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server: ready (stdio)");
})();
