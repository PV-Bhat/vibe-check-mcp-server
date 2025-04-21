// src/index.ts
import { McpServer }         from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ①  Import the handlers (and, if you exported them, their Zod schemas)
import {
  vibeCheckTool,
  vibeCheckInputSchema   // <- z.object({...})
} from "./tools/vibeCheck.js";

import {
  vibeDistillTool,
  vibeDistillInputSchema
} from "./tools/vibeDistill.js";

import {
  vibeLearnTool,
  vibeLearnInputSchema
} from "./tools/vibeLearn.js";

const server = new McpServer({ name: "vibe-check-mcp", version: "0.2.0" });

/* ─── Register tools exactly once ────────────────────────────── */
server.tool("vibe_check",   vibeCheckInputSchema.shape,   vibeCheckTool);
server.tool("vibe_distill", vibeDistillInputSchema.shape, vibeDistillTool);
server.tool("vibe_learn",   vibeLearnInputSchema.shape,   vibeLearnTool);

/* ─── Kick‑off ──────────────────────────────────────────────── */
async function main () {
  await server.connect(new StdioServerTransport());
}
main().catch(err => {
  console.error("Fatal MCP start‑up error:", err);
  process.exit(1);
});
