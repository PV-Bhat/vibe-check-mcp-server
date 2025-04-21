#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server }                   from '@modelcontextprotocol/sdk/server/index.js';
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z }                        from 'zod';

// ─────────────────────────────────────────────
//  1. Define your tool’s Zod schema & types
// ─────────────────────────────────────────────
const VibeCheckParams = {
  plan:          z.string(),
  userRequest:  z.string(),
  thinkingLog:   z.string().optional(),
  availableTools: z.array(z.string()).optional(),
  splitOutput:   z.boolean().optional(),
  confidence:    z.number().optional(),
};
type VibeCheckInput = z.input<typeof z.object(VibeCheckParams)>;

const VIBE_CHECK_TOOL = 'vibe-check';

// ─────────────────────────────────────────────
//  2. Bootstrap the server + transport
// ─────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  const server = new Server(
    { name: 'vibe-check-mcp', version: '0.2.0' },
    transport
  );

  console.error('⌛ Starting vibe‑check MCP server…');

  // ─────────────────────────────────────────────
  // 3. handle “initialize”
  // ─────────────────────────────────────────────
  server.setRequestHandler(InitializeRequestSchema, async req => ({
    protocolVersion: req.params.protocolVersion,
    serverInfo:      { name: 'vibe-check-mcp', version: '0.2.0' },
    // tell the client what tools you support
    capabilities:    { tools: [VIBE_CHECK_TOOL] },
  }));

  // ─────────────────────────────────────────────
  // 4. handle “listTools”
  // ─────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name:        VIBE_CHECK_TOOL,
        description: 'Do a vibe‑check on the user’s plan + request',
        // pass the raw Zod shape here
        paramsSchema: VibeCheckParams,
      },
    ],
  }));

  // ─────────────────────────────────────────────
  // 5. register your actual tool implementation
  // ─────────────────────────────────────────────
  server.registerTool(
    VIBE_CHECK_TOOL,
    VibeCheckParams,
    async (args: VibeCheckInput, extra) => {
      // This is where your vibe‑check logic goes.
      // For demo, just echo back the inputs:
      return {
        content: [
          { __type: 'text', text: `📋 Plan: ${args.plan}` },
          { __type: 'text', text: `❓ Request: ${args.userRequest}` },
        ],
      };
    }
  );

  // ─────────────────────────────────────────────
  // 6. wire up “callTool” to invoke your registered tools
  // ─────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async req => {
    const { tool, params } = req.params;
    // this will route to the handler you registered above
    return server.invokeTool(tool, params, req);
  });

  // ─────────────────────────────────────────────
  // 7. start listening!
  // ─────────────────────────────────────────────
  await server.connect(transport);
  console.error('✅ Server started and listening on stdio');
}

main().catch(err => {
  console.error('💥 Fatal startup error:', err);
  process.exit(1);
});
