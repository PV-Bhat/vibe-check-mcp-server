#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/transports/stdio";
import { Server } from "@modelcontextprotocol/sdk/server";
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
  isToolRun,
} from "@modelcontextprotocol/sdk";
import { vibeCheckTool, VibeCheckInput } from "./tools/vibeCheck.js";
import { vibeDistillTool, VibeDistillInput } from "./tools/vibeDistill.js";
import { vibeLearnTool, VibeLearnInput } from "./tools/vibeLearn.js";

async function main() {
  // 1) Wire up stdio transport and server
  const transport = new StdioServerTransport();
  const server = new Server({ transport });

  console.error("vibe‑check MCP server starting…");

  // 2) Handle initialize
  server.setRequestHandler(InitializeRequestSchema, async req => ({
    protocolVersion: req.params.protocolVersion,
    serverInfo: { name: "vibe‑check‑mcp", version: "0.2.0" },
    // tell the client we support tools
    capabilities: { tools: {} },
  }));

  // 3) List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: "vibe_check",   description: "Ask metacognitive questions to break tunnel vision" },
      { name: "vibe_distill", description: "Summarize key decisions and mistakes"       },
      { name: "vibe_learn",   description: "Provide learning tips based on mistakes"   },
    ],
  }));

  // 4) Tool: vibe_check
  server.setRequestHandler(isToolRun("vibe_check"), async req => {
    if (!req.params) {
      throw new McpError(ErrorCode.InvalidRequest, "Missing parameters for vibe_check");
    }
    const input = req.params as VibeCheckInput;
    const { questions, patternAlert } = await vibeCheckTool(input);
    return {
      content: [
        { name: "questions",    value: questions },
        ...(patternAlert ? [{ name: "patternAlert", value: patternAlert }] : []),
      ],
    };
  });

  // 5) Tool: vibe_distill
  server.setRequestHandler(isToolRun("vibe_distill"), async req => {
    if (!req.params) {
      throw new McpError(ErrorCode.InvalidRequest, "Missing parameters for vibe_distill");
    }
    const input = req.params as VibeDistillInput;
    const { summary } = await vibeDistillTool(input);
    return {
      content: [
        { name: "summary", value: summary },
      ],
    };
  });

  // 6) Tool: vibe_learn
  server.setRequestHandler(isToolRun("vibe_learn"), async req => {
    if (!req.params) {
      throw new McpError(ErrorCode.InvalidRequest, "Missing parameters for vibe_learn");
    }
    const input = req.params as VibeLearnInput;
    const { tips } = await vibeLearnTool(input);
    return {
      content: [
        { name: "tips", value: tips },
      ],
    };
  });

  // 7) Start listening for MCP messages
  await server.connect();
}

main().catch(err => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
