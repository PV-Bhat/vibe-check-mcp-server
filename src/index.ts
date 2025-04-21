// src/index.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";      // MCP server class :contentReference[oaicite:0]{index=0}
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";  // STDIO transport :contentReference[oaicite:1]{index=1}
import { z } from "zod";                                                  // For defining input schemas :contentReference[oaicite:2]{index=2}

import { vibeCheckTool } from "./tools/vibeCheck.js";
import { vibeDistillTool } from "./tools/vibeDistill.js";
import { vibeLearnTool } from "./tools/vibeLearn.js";

// 1. Initialize the MCP server
const server = new McpServer({
  name: "vibe-check-mcp",
  version: "0.2.0"
});

// 2. Define the `vibe_check` tool
server.tool(
  "vibe_check",
  z.object({
    plan: z.string(),
    userRequest: z.string(),
    thinkingLog: z.string().optional(),
    availableTools: z.array(z.string()).optional(),
    focusAreas: z.array(z.string()).optional(),
    sessionId: z.string().optional(),
    previousAdvice: z.string().optional(),
    phase: z.enum(["planning", "implementation", "review"]).optional(),
    confidence: z.number().optional()
  }).required({ plan: true, userRequest: true }),
  async (args) => {
    const result = await vibeCheckTool(args);
    return {
      content: [{
        type: "text",
        text: result.questions + (result.patternAlert ? `\n\n**Pattern Alert:** ${result.patternAlert}` : "")
      }]
    };
  }
);

// 3. Define the `vibe_distill` tool
server.tool(
  "vibe_distill",
  z.object({
    plan: z.string(),
    userRequest: z.string(),
    sessionId: z.string().optional()
  }).required({ plan: true, userRequest: true }),
  async (args) => {
    const result = await vibeDistillTool(args);
    return {
      content: [{
        type: "markdown",
        markdown: result.distilledPlan + `\n\n**Rationale:** ${result.rationale}`
      }]
    };
  }
);

// 4. Define the `vibe_learn` tool
server.tool(
  "vibe_learn",
  z.object({
    mistake: z.string(),
    category: z.string(),
    solution: z.string(),
    sessionId: z.string().optional()
  }).required({ mistake: true, category: true, solution: true }),
  async (args) => {
    const result = await vibeLearnTool(args);
    const summary = result.topCategories
      .map(cat => `- ${cat.category} (${cat.count})`)
      .join("\n");
    return {
      content: [{
        type: "text",
        text: `✅ Pattern logged. Current tally: ${result.currentTally}.\nTop Categories:\n${summary}`
      }]
    };
  }
);

// 5. Set up the STDIO transport and connect
const transport = new StdioServerTransport();
server.connect(transport);
console.log("Vibe Check MCP Server started using STDIO transport.");
