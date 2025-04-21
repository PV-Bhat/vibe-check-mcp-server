#!/usr/bin/env node
// ─── imports ────────────────────────────────────────────────────────────────
import { createServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport }
  from '@modelcontextprotocol/sdk/server/transports/stdio.js';
import { z } from 'zod';

import {
  vibeCheckTool,  VibeCheckInput,  vibeCheckSchema,
  vibeDistillTool, VibeDistillInput, vibeDistillSchema,
  vibeLearnTool,  VibeLearnInput,  vibeLearnSchema,
} from './tools/index.js';               // consolidate exports in ./tools/index.ts
import { MistakeEntry } from './utils/storage.js';

// ─── constants ──────────────────────────────────────────────────────────────
const NAME    = 'vibe-check-mcp';
const VERSION = '0.2.0';

// ─── server instance ────────────────────────────────────────────────────────
const server = createServer({
  name: NAME,
  version: VERSION,
});

// NOTE: *no* initialize / tools‑list handlers are needed –
// createServer already wires those up.

// ─── tool registration ─────────────────────────────────────────────────────
server.registerTool<VibeCheckInput>('vibe_check', vibeCheckSchema, async args => {
  const res = await vibeCheckTool(args);
  return {
    content: [
      {
        type : 'text',
        text : res.questions +
               (res.patternAlert ? `\n\n**Pattern Alert:** ${res.patternAlert}` : ''),
      },
    ],
  };
});

server.registerTool<VibeDistillInput>('vibe_distill', vibeDistillSchema, async args => {
  const res = await vibeDistillTool(args);
  return {
    content: [
      { type: 'markdown', markdown: `${res.distilledPlan}\n\n**Why:** ${res.rationale}` },
    ],
  };
});

server.registerTool<VibeLearnInput>('vibe_learn', vibeLearnSchema, async args => {
  const res = await vibeLearnTool(args);
  const lines = res.topCategories
    .map((c: {category:string;count:number}) => `- ${c.category} (${c.count})`)
    .join('\n');
  return {
    content: [
      {
        type : 'text',
        text : `✅ Pattern logged. Tally now ${res.currentTally}.\nTop categories:\n${lines}`,
      },
    ],
  };
});

// ─── transport – stdio (Claude Desktop / Smithery) ──────────────────────────
const transport = new StdioServerTransport();

// Immediately‑invoked async so top‑level await works in CJS as well
(async () => {
  try {
    await server.connect(transport);   // returns a promise in 1.10
    console.error('[OK] vibe‑check‑mcp ready (stdio)');
  } catch (err) {
    console.error('[FATAL] could not start server:', err);
    process.exit(1);
  }
})();
