#!/usr/bin/env node
import { z } from "zod";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";

// import your real tool handlers
import {
  vibeCheckTool,
  VibeCheckInput as RawVibeCheckInput,
  VibeCheckOutput,
} from "./tools/vibeCheck.js";
import {
  vibeDistillTool,
  VibeDistillInput as RawVibeDistillInput,
} from "./tools/vibeDistill.js";
import {
  vibeLearnTool,
  VibeLearnInput as RawVibeLearnInput,
} from "./tools/vibeLearn.js";

// 1) Zod schemas matching your TS interfaces
const VibeCheckInputSchema = z.object({
  plan: z.string(),
  userRequest: z.string(),
  thinkingLog: z.string().optional(),
  availableTools: z.array(z.string()).optional(),
  focusAreas: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
  previousAdvice: z.string().optional(),
  phase: z.enum(["planning", "implementation", "review"]).optional(),
  confidence: z.number().optional(),
});
type VibeCheckInput = z.infer<typeof VibeCheckInputSchema>;

const VibeDistillInputSchema = z.object({
  plan: z.string(),
  userRequest: z.string(),
  sessionId: z.string().optional(),
});
type VibeDistillInput = z.infer<typeof VibeDistillInputSchema>;

const VibeLearnInputSchema = z.object({
  category: z.string(),
  mistake: z.string(),
  solution: z.string(),
  sessionId: z.string().optional(),
});
type VibeLearnInput = z.infer<typeof VibeLearnInputSchema>;

// 2) Create MCP server
const server = new Server(
  { name: "vibe‑check‑mcp", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

// 3) initialize handler
server.setRequestHandler(InitializeRequestSchema, async (req) => ({
  protocolVersion: req.params.protocolVersion,
  serverInfo: { name: "vibe‑check‑mcp", version: "0.2.0" },
  capabilities: { tools: {} },
}));

// 4) listTools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "vibe_check",
      description:
        "Metacognitive questioning tool: breaks tunnel vision and checks assumptions.",
      inputSchema: VibeCheckInputSchema,
    },
    {
      name: "vibe_distill",
      description: "Condense a plan into a concise, actionable summary.",
      inputSchema: VibeDistillInputSchema,
    },
    {
      name: "vibe_learn",
      description: "Record lessons learned: mistakes + solutions.",
      inputSchema: VibeLearnInputSchema,
    },
  ],
}));

// 5) callTool handler
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  try {
    switch (name) {
      case "vibe_check": {
        const input = VibeCheckInputSchema.parse(args) as VibeCheckInput;
        const out: VibeCheckOutput = await vibeCheckTool(input);
        // return questions + optional alert as text blocks
        const content = [
          { type: "text" as const, text: out.questions },
          ...(out.patternAlert
            ? [{ type: "text" as const, text: out.patternAlert }]
            : []),
        ];
        return { content };
      }

      case "vibe_distill": {
        const input = VibeDistillInputSchema.parse(args) as VibeDistillInput;
        const summary = await vibeDistillTool(
          input.plan,
          input.userRequest,
          input.sessionId
        );
        return {
          content: [{ type: "text" as const, text: summary }],
        };
      }

      case "vibe_learn": {
        const input = VibeLearnInputSchema.parse(args) as VibeLearnInput;
        await vibeLearnTool(input); // records to storage
        return {
          content: [
            {
              type: "text" as const,
              text: "Lesson recorded successfully.",
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.ToolNotFound,
          `Tool not found: ${name}`
        );
    }
  } catch (err) {
    // Zod validation errors → MCP invalid‑params
    if (err instanceof z.ZodError) {
      throw new McpError(ErrorCode.InvalidParams, err.message);
    }
    throw err;
  }
});

// 6) connect over stdio
await server.connect(new StdioServerTransport());
