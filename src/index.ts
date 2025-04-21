// src/index.ts
import { Server }            from "@modelcontextprotocol/sdk/server/index.js";
import { tools }             from "@modelcontextprotocol/sdk/server/tools";   // ← wrap helper
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z }                 from "zod";

// 1.  create the lean base Server
const base = new Server({ name: "vibe-check-mcp", version: "0.2.0" });

// 2.  wrap it – “upgrade” to a Tools‑aware server
const server = tools(base);                // ‹– now `.tool()` exists and is correctly typed

// 3.  define each tool
server.tool(
  "vibe_check",
  z.object({
    plan:        z.string(),
    userRequest: z.string()
  }),
  async args => {
    /* your implementation */
    return { content: [{ type: "text", text: "✅ check OK" }] };
  }
);

server.tool(
  "vibe_distill",
  z.object({ plan: z.string(), userRequest: z.string() }),
  async args => {
    /* … */
  }
);

server.tool(
  "vibe_learn",
  z.object({ mistake: z.string(), category: z.string(), solution: z.string() }),
  async args => {
    /* … */
  }
);

// 4.  stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[OK] vibe‑check‑mcp ready (stdio)");
