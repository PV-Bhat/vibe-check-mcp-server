// src/index.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  type InitializeRequest,
  type CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { vibeCheckTool, type VibeCheckInput }   from "./tools/vibeCheck.js";
import { vibeDistillTool, type VibeDistillInput } from "./tools/vibeDistill.js";
import { vibeLearnTool, type VibeLearnInput }     from "./tools/vibeLearn.js";

////////////////////////////////////////////////////////////////////////////////
// 0.  Schemas (Zod gives us both runtime validation and static typing)
////////////////////////////////////////////////////////////////////////////////
const vibeCheckSchema   = z.object({ plan:z.string(), userRequest:z.string(),
  thinkingLog:z.string().optional(), availableTools:z.string().array().optional(),
  focusAreas:z.string().array().optional(), sessionId:z.string().optional(),
  previousAdvice:z.string().optional(),
  phase:z.enum(["planning","implementation","review"]).optional(),
  confidence:z.number().optional() }).strict();

const vibeDistillSchema = z.object({ plan:z.string(), userRequest:z.string(),
  sessionId:z.string().optional() }).strict();

const vibeLearnSchema   = z.object({ mistake:z.string(), category:z.string(),
  solution:z.string(), sessionId:z.string().optional() }).strict();

////////////////////////////////////////////////////////////////////////////////
// 1.  Server bootstrap
////////////////////////////////////////////////////////////////////////////////
const SERVER_INFO = { name: "vibe-check-mcp", version: "0.2.0" };

const server = new Server({
  ...SERVER_INFO,
  capabilities: { tools: {} }   // required so the client will ask for tools/list
});

server.setRequestHandler(InitializeRequestSchema, async (req:InitializeRequest) => ({
  protocolVersion: req.params.protocolVersion,
  serverInfo:      SERVER_INFO,
  capabilities:    { tools: {} },
}));

// tools/list ---------------------------------------------------------------
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name:"vibe_check",   description:"Metacognitive check", inputSchema:vibeCheckSchema },
    { name:"vibe_distill", description:"Distil a plan",       inputSchema:vibeDistillSchema },
    { name:"vibe_learn",   description:"Log mistake",         inputSchema:vibeLearnSchema },
  ]
}));

// tools/call ---------------------------------------------------------------
server.setRequestHandler(CallToolRequestSchema, async (req:CallToolRequest) => {
  const { name, arguments:raw={} } = req.params;

  try {
    switch (name) {
      case "vibe_check": {
        const args = vibeCheckSchema.parse(raw) as VibeCheckInput;
        const out  = await vibeCheckTool(args);
        return { content:[{type:"text",text:out.questions + (out.patternAlert?`\n\nPattern: ${out.patternAlert}`:"")}] };
      }
      case "vibe_distill": {
        const args = vibeDistillSchema.parse(raw) as VibeDistillInput;
        const out  = await vibeDistillTool(args);
        return { content:[{type:"markdown",markdown:`${out.distilledPlan}\n\n**Why:** ${out.rationale}`} ] };
      }
      case "vibe_learn": {
        const args = vibeLearnSchema.parse(raw) as VibeLearnInput;
        const out  = await vibeLearnTool(args);
        const cats = out.topCategories.map(c=>`• ${c.category} (${c.count})`).join("\n");
        return { content:[{type:"text",text:`Logged ✅\nCurrent tally: ${out.currentTally}\n\nTop categories:\n${cats}`}] };
      }
      default:
        return { error:{ code:"tool_not_found", message:`Unknown tool "${name}"` } };
    }
  } catch(err:any){
    if (err instanceof z.ZodError) {
      return { error:{ code:"invalid_params", message:err.errors.map(e=>e.message).join(", ") } };
    }
    return { error:{ code:"tool_execution_error", message:err.message } };
  }
});

////////////////////////////////////////////////////////////////////////////////
// 2.  Attach stdio transport
////////////////////////////////////////////////////////////////////////////////
(async () => {
  try {
    await server.connect(new StdioServerTransport());
    console.error("[OK] vibe‑check‑mcp ready (stdio)");
  } catch (e) {
    console.error("[FATAL] could not start server:", e);
    process.exit(1);
  }
})();
