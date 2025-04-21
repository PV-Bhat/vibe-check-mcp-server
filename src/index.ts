#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server }                   from '@modelcontextprotocol/sdk/server/index.js';
import {
  InitializeRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z, ZodRawShape }           from 'zod';

// ─────────────────────────────────────────────
//  1. Define your tool’s Zod “raw shape” & types
// ─────────────────────────────────────────────
const VIBE_CHECK_TOOL = 'vibe-check';

// This object is a ZodRawShape (string→ZodType) that registerTool accepts
const VibeCheckParams: ZodRawShape = {
  plan:           z.string(),
  userRequest:    z.string(),
  thinkingLog:    z.string().optional(),
  availableTools: z.array(z.string()).optional(),
  splitOutput:    z.boolean().optional(),
  confidence:     z.number().optional(),
};

// Build a Zod schema from it so we can infer a TS type:
const VibeCheckSchema = z.object(VibeCheckParams);
type VibeCheckInput = z.infer<typeof VibeCheckSchema>;

// ─────────────────────────────────────────────
//  2. Bootstrap the server + stdio transport
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
  server.setRequestHandler(InitializeRequestSchema, async (req) => ({
    protocolVersion: req.params.protocolVersion,
    serverInfo:      { name: 'vibe-check-mcp', version: '0.2.0' },
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
        paramsSchema: VibeCheckParams,
      },
    ],
  }));

  // ─────────────────────────────────────────────
  // 5. register your tool’s implementation
  // ─────────────────────────────────────────────
  server.registerTool(
    VIBE_CHECK_TOOL,
    VibeCheckParams,
    async (args: VibeCheckInput) => {
      // ← your logic goes here. This just echoes back two text blocks:
      return {
        content: [
          { __type: 'text', text: `📋 Plan: ${args.plan}` },
          { __type: 'text', text: `❓ Request: ${args.userRequest}` },
        ],
      };
    }
  );

  // ─────────────────────────────────────────────
  // 6. handle “callTool” by dispatching to registerTool’d handlers
  // ─────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { tool, params } = req.params;
    return server.invokeTool(tool, params, req);
  });

  // ─────────────────────────────────────────────
  // 7. connect!
  // ─────────────────────────────────────────────
  await server.connect(transport);
  console.error('✅ Server started and listening on stdio');
}

main().catch((err) => {
  console.error('💥 Fatal startup error:', err);
  process.exit(1);
});
