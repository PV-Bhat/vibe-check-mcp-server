#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpError, ErrorCode, ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { vibeCheckTool, VibeCheckInput, VibeCheckOutput } from './tools/vibeCheck.js';
import { vibeLearnTool, VibeLearnInput, VibeLearnOutput } from './tools/vibeLearn.js';
import { updateConstitution, resetConstitution, getConstitution } from './tools/constitution.js';
import { STANDARD_CATEGORIES, LearningType } from './utils/storage.js';
import { loadHistory } from './utils/state.js';

const IS_DISCOVERY = process.env.MCP_DISCOVERY_MODE === '1';
const USE_STDIO = process.env.MCP_TRANSPORT === 'stdio';

if (USE_STDIO) {
  console.log = (...args) => console.error(...args);
}

async function main() {
  await loadHistory();

  const server = new Server(
    { name: 'vibe-check', version: '2.5.0' },
    { capabilities: { tools: {}, sampling: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'vibe_check',
        description: 'Metacognitive questioning tool that identifies assumptions and breaks tunnel vision to prevent cascading errors',
        inputSchema: {
          type: 'object',
          properties: {
            goal: {
              type: 'string',
              description: "The agent's current goal",
              examples: ['Ship CPI v2.5 with zero regressions']
            },
            plan: {
              type: 'string',
              description: "The agent's detailed plan",
              examples: ['1) Write tests 2) Refactor 3) Canary rollout']
            },
            modelOverride: {
              type: 'object',
              properties: {
                provider: { type: 'string', enum: ['gemini', 'openai', 'openrouter'] },
                model: { type: 'string' }
              },
              required: [],
              examples: [{ provider: 'gemini', model: 'gemini-2.5-pro' }]
            },
            userPrompt: {
              type: 'string',
              description: 'The original user prompt',
              examples: ['Summarize the repo']
            },
            progress: {
              type: 'string',
              description: "The agent's progress so far",
              examples: ['Finished step 1']
            },
            uncertainties: {
              type: 'array',
              items: { type: 'string' },
              description: "The agent's uncertainties",
              examples: [['uncertain about deployment']]
            },
            taskContext: {
              type: 'string',
              description: 'The context of the current task',
              examples: ['repo: vibe-check-mcp @2.5.0']
            },
            sessionId: {
              type: 'string',
              description: 'Optional session ID for state management',
              examples: ['session-123']
            }
          },
          required: ['goal', 'plan'],
          additionalProperties: false
        }
      },
      {
        name: 'vibe_learn',
        description: 'Pattern recognition system that tracks common errors and solutions to prevent recurring issues',
        inputSchema: {
          type: 'object',
          properties: {
            mistake: {
              type: 'string',
              description: 'One-sentence description of the learning entry',
              examples: ['Skipped writing tests']
            },
            category: {
              type: 'string',
              description: `Category (standard categories: ${STANDARD_CATEGORIES.join(', ')})`,
              enum: STANDARD_CATEGORIES,
              examples: ['Premature Implementation']
            },
            solution: {
              type: 'string',
              description: 'How it was corrected (if applicable)',
              examples: ['Added regression tests']
            },
            type: {
              type: 'string',
              enum: ['mistake', 'preference', 'success'],
              description: 'Type of learning entry',
              examples: ['mistake']
            },
            sessionId: {
              type: 'string',
              description: 'Optional session ID for state management',
              examples: ['session-123']
            }
          },
          required: ['mistake', 'category'],
          additionalProperties: false
        }
      },
      {
        name: 'update_constitution',
        description: 'Append a constitutional rule for this session (in-memory)',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', examples: ['session-123'] },
            rule: { type: 'string', examples: ['Always write tests first'] }
          },
          required: ['sessionId', 'rule'],
          additionalProperties: false
        }
      },
      {
        name: 'reset_constitution',
        description: 'Overwrite all constitutional rules for this session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', examples: ['session-123'] },
            rules: {
              type: 'array',
              items: { type: 'string' },
              examples: [['Be kind', 'Avoid loops']]
            }
          },
          required: ['sessionId', 'rules'],
          additionalProperties: false
        }
      },
      {
        name: 'check_constitution',
        description: 'Return the current constitution rules for this session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', examples: ['session-123'] }
          },
          required: ['sessionId'],
          additionalProperties: false
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: raw } = req.params;
    const args: any = raw;

    switch (name) {
      case 'vibe_check': {
        const missing: string[] = [];
        if (!args || typeof args.goal !== 'string') missing.push('goal');
        if (!args || typeof args.plan !== 'string') missing.push('plan');
        if (missing.length) {
          const example = '{"goal":"Ship CPI v2.5","plan":"1) tests 2) refactor 3) canary"}';
          if (IS_DISCOVERY) {
            return { content: [{ type: 'text', text: `discovery: missing [${missing.join(', ')}]; example: ${example}` }] };
          }
          throw new McpError(ErrorCode.InvalidParams, `Missing: ${missing.join(', ')}. Example: ${example}`);
        }
        const input: VibeCheckInput = {
          goal: args.goal,
          plan: args.plan,
          modelOverride: typeof args.modelOverride === 'object' && args.modelOverride !== null ? args.modelOverride : undefined,
          userPrompt: typeof args.userPrompt === 'string' ? args.userPrompt : undefined,
          progress: typeof args.progress === 'string' ? args.progress : undefined,
          uncertainties: Array.isArray(args.uncertainties) ? args.uncertainties : undefined,
          taskContext: typeof args.taskContext === 'string' ? args.taskContext : undefined,
          sessionId: typeof args.sessionId === 'string' ? args.sessionId : undefined,
        };
        const result = await vibeCheckTool(input);
        return { content: [{ type: 'text', text: formatVibeCheckOutput(result) }] };
      }

      case 'vibe_learn': {
        const missing: string[] = [];
        if (!args || typeof args.mistake !== 'string') missing.push('mistake');
        if (!args || typeof args.category !== 'string') missing.push('category');
        if (missing.length) {
          const example = '{"mistake":"Skipped tests","category":"Feature Creep"}';
          if (IS_DISCOVERY) {
            return { content: [{ type: 'text', text: `discovery: missing [${missing.join(', ')}]; example: ${example}` }] };
          }
          throw new McpError(ErrorCode.InvalidParams, `Missing: ${missing.join(', ')}. Example: ${example}`);
        }
        const input: VibeLearnInput = {
          mistake: args.mistake,
          category: args.category,
          solution: typeof args.solution === 'string' ? args.solution : undefined,
          type: ['mistake', 'preference', 'success'].includes(args.type as string)
            ? (args.type as LearningType)
            : undefined,
          sessionId: typeof args.sessionId === 'string' ? args.sessionId : undefined
        };
        const result = await vibeLearnTool(input);
        return { content: [{ type: 'text', text: formatVibeLearnOutput(result) }] };
      }

      case 'update_constitution': {
        const missing: string[] = [];
        if (!args || typeof args.sessionId !== 'string') missing.push('sessionId');
        if (!args || typeof args.rule !== 'string') missing.push('rule');
        if (missing.length) {
          const example = '{"sessionId":"123","rule":"Always write tests first"}';
          if (IS_DISCOVERY) {
            return { content: [{ type: 'text', text: `discovery: missing [${missing.join(', ')}]; example: ${example}` }] };
          }
          throw new McpError(ErrorCode.InvalidParams, `Missing: ${missing.join(', ')}. Example: ${example}`);
        }
        updateConstitution(args.sessionId, args.rule);
        console.log('[Constitution:update]', { sessionId: args.sessionId, count: getConstitution(args.sessionId).length });
        return { content: [{ type: 'text', text: '✅ Constitution updated' }] };
      }

      case 'reset_constitution': {
        const missing: string[] = [];
        if (!args || typeof args.sessionId !== 'string') missing.push('sessionId');
        if (!args || !Array.isArray(args.rules)) missing.push('rules');
        if (missing.length) {
          const example = '{"sessionId":"123","rules":["Be kind","Avoid loops"]}';
          if (IS_DISCOVERY) {
            return { content: [{ type: 'text', text: `discovery: missing [${missing.join(', ')}]; example: ${example}` }] };
          }
          throw new McpError(ErrorCode.InvalidParams, `Missing: ${missing.join(', ')}. Example: ${example}`);
        }
        resetConstitution(args.sessionId, args.rules);
        console.log('[Constitution:reset]', { sessionId: args.sessionId, count: getConstitution(args.sessionId).length });
        return { content: [{ type: 'text', text: '✅ Constitution reset' }] };
      }

      case 'check_constitution': {
        const missing: string[] = [];
        if (!args || typeof args.sessionId !== 'string') missing.push('sessionId');
        if (missing.length) {
          const example = '{"sessionId":"123"}';
          if (IS_DISCOVERY) {
            return { content: [{ type: 'text', text: `discovery: missing [${missing.join(', ')}]; example: ${example}` }] };
          }
        
          throw new McpError(ErrorCode.InvalidParams, `Missing: ${missing.join(', ')}. Example: ${example}`);
        }
        const rules = getConstitution(args.sessionId);
        console.log('[Constitution:check]', { sessionId: args.sessionId, count: rules.length });
        return { content: [{ type: 'text', text: JSON.stringify({ rules }) }] };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  });

  const app = express();
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  app.use(cors({ origin: allowedOrigin }));
  app.use(express.json());

  if (USE_STDIO) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[MCP] stdio transport connected');
  } else {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);

    app.post('/mcp', async (req, res) => {
      const started = Date.now();
      const { id, method } = req.body ?? {};
      const sessionId = req.body?.params?.sessionId || req.body?.params?.arguments?.sessionId;
      console.log('[MCP] request', { id, method, sessionId });
      try {
        await transport.handleRequest(req, res, req.body);
      } catch (e: any) {
        console.error('[MCP] error', { err: e?.message, id });
        if (!res.headersSent) {
          res.status(500).json({ jsonrpc: '2.0', id: id ?? null, error: { code: -32603, message: 'Internal server error' } });
        }
      } finally {
        console.log('[MCP] handled', { id, ms: Date.now() - started });
      }
    });

    app.get('/mcp', (_req, res) => {
      res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
    });

    app.get('/healthz', (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    const PORT = Number(process.env.MCP_HTTP_PORT || process.env.PORT || 3000);
    const listener = app.listen(PORT, () => {
      const addr = listener.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : PORT;
      console.log(`[MCP] HTTP listening on :${actualPort}`);
    });

    const close = () => listener.close(() => process.exit(0));
    process.on('SIGTERM', close);
    process.on('SIGINT', close);
  }
}

function formatVibeCheckOutput(result: VibeCheckOutput): string {
  return result.questions;
}

function formatVibeLearnOutput(result: VibeLearnOutput): string {
  let output = '';

  if (result.added) {
    output += `✅ Pattern logged successfully (category tally: ${result.currentTally})`;
  } else if (result.alreadyKnown) {
    output += 'ℹ️ Pattern already recorded';
  } else {
    output += '❌ Failed to log pattern';
  }

  if (result.topCategories && result.topCategories.length > 0) {
    output += '\n\n## Top Pattern Categories\n';
    for (const category of result.topCategories) {
      output += `\n### ${category.category} (${category.count} occurrences)\n`;
      if (category.recentExample) {
        output += `Most recent: "${category.recentExample.mistake}"\n`;
        output += `Solution: "${category.recentExample.solution}"\n`;
      }
    }
  }

  return output;
}

main().catch((error) => {
  console.error('Server startup error:', error);
  process.exit(1);
});
