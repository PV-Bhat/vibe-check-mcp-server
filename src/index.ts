#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import {
  vibeCheckTool,
  VibeCheckInput,
  VibeCheckOutput,
} from "./tools/vibeCheck.js";
import {
  vibeDistillTool,
  VibeDistillInput,
  VibeDistillOutput,
} from "./tools/vibeDistill.js";
import {
  vibeLearnTool,
  VibeLearnInput,
  VibeLearnOutput,
} from "./tools/vibeLearn.js";

// 1) Create the server with its name/version and declare it supports "tools"
const server = new Server(
  { name: "vibe-check-mcp", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

// 2) Handler for listing available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "vibe_check",
      description: "Metacognitive questioning to identify assumptions and break tunnel vision.",
      // omit parameters or set to null to let clients infer
      parameters: null,
    },
    {
      name: "vibe_distill",
      description: "Distill core mistakes and solutions for review and learning.",
      parameters: null,
    },
    {
      name: "vibe_learn",
      description: "Store and categorize mistakes for future reference.",
      parameters: null,
    },
  ],
}));

// 3) Handler for executing tool invocations
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  switch (name) {
    case "vibe_check": {
      const input = args as VibeCheckInput;
      const output = await vibeCheckTool(input);
      return {
        content: [
          { type: "application/json", data: output as VibeCheckOutput },
        ],
      };
    }

    case "vibe_distill": {
      const input = args as VibeDistillInput;
      const output = await vibeDistillTool(input);
      return {
        content: [
          { type: "application/json", data: output as VibeDistillOutput },
        ],
      };
    }

    case "vibe_learn": {
      const input = args as VibeLearnInput;
      const output = await vibeLearnTool(input);
      return {
        content: [
          { type: "application/json", data: output as VibeLearnOutput },
        ],
      };
    }

    default:
      // use MethodNotFound (ToolNotFound was removed) and only pass code+message
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Tool not found: ${name}`
      );
  }
});

// 4) Wire up the stdio transport and start listening
const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
  console.error("Fatal transport error:", err);
  process.exit(1);
});
