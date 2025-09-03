#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpError, ErrorCode, ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { vibeCheckTool, VibeCheckInput, VibeCheckOutput } from './tools/vibeCheck.js';
import { vibeLearnTool, VibeLearnInput, VibeLearnOutput } from './tools/vibeLearn.js';
import { updateConstitution, resetConstitution, getConstitution } from './tools/constitution.js';
import { STANDARD_CATEGORIES, LearningType } from './utils/storage.js';
import { loadHistory } from './utils/state.js';

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
            goal: { type: 'string', description: "The agent's current goal" },
            plan: { type: 'string', description: "The agent's detailed plan" },
            modelOverride: {
              type: 'object',
              properties: {
                provider: { type: 'string', enum: ['gemini', 'openai', 'openrouter'] },
                model: { type: 'string' }
              },
              required: []
            },
            userPrompt: { type: 'string', description: 'The original user prompt' },
            progress: { type: 'string', description: "The agent's progress so far" },
            uncertainties: { type: 'array', items: { type: 'string' }, description: "The agent's uncertainties" },
            taskContext: { type: 'string', description: 'The context of the current task' },
            sessionId: { type: 'string', description: 'Optional session ID for state management' }
          },
          required: ['goal', 'plan']
        }
      },
      {
        name: 'vibe_learn',
        description: 'Pattern recognition system that tracks common errors and solutions to prevent recurring issues',
        inputSchema: {
          type: 'object',
          properties: {
            mistake: { type: 'string', description: 'One-sentence description of the learning entry' },
            category: { type: 'string', description: `Category (standard categories: ${STANDARD_CATEGORIES.join(', ')})`, enum: STANDARD_CATEGORIES },
            solution: { type: 'string', description: 'How it was corrected (if applicable)' },
            type: { type: 'string', enum: ['mistake', 'preference', 'success'], description: 'Type of learning entry' },
            sessionId: { type: 'string', description: 'Optional session ID for state management' }
          },
          required: ['mistake', 'category']
        }
      },
      {
        name: 'update_constitution',
        description: 'Append a constitutional rule for this session (in-memory)',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            rule: { type: 'string' }
          },
          required: ['sessionId', 'rule']
        }
      },
      {
        name: 'reset_constitution',
        description: 'Overwrite all constitutional rules for this session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            rules: { type: 'array', items: { type: 'string' } }
          },
          required: ['sessionId', 'rules']
        }
      },
      {
        name: 'check_constitution',
        description: 'Return the current constitution rules for this session',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' }
          },
          required: ['sessionId']
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    switch (name) {
      case 'vibe_check': {
        if (!args || typeof args.goal !== 'string' || typeof args.plan !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'goal and plan are required strings');
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
        if (!args || typeof args.mistake !== 'string' || typeof args.category !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'mistake and category are required strings');
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
        if (!args || typeof args.sessionId !== 'string' || typeof args.rule !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'sessionId (string) and rule (string) are required');
        }
        updateConstitution(args.sessionId, args.rule);
        console.log('[Constitution:update]', { sessionId: args.sessionId, count: getConstitution(args.sessionId).length });
        return { content: [{ type: 'text', text: '✅ Constitution updated' }] };
      }

      case 'reset_constitution': {
        if (!args || typeof args.sessionId !== 'string' || !Array.isArray(args.rules)) {
          throw new McpError(ErrorCode.InvalidParams, 'sessionId (string) and rules (string[]) are required');
        }
        resetConstitution(args.sessionId, args.rules);
        console.log('[Constitution:reset]', { sessionId: args.sessionId, count: getConstitution(args.sessionId).length });
        return { content: [{ type: 'text', text: '✅ Constitution reset' }] };
      }

      case 'check_constitution': {
        if (!args || typeof args.sessionId !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'sessionId (string) is required');
        }
        const rules = getConstitution(args.sessionId);
        console.log('[Constitution:check]', { sessionId: args.sessionId, count: rules.length });
        return { content: [{ type: 'json', json: { rules } }] };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  });

  const app = express();
  const allowedOrigin = process.env.CORS_ORIGIN || '*';
  app.use(cors({ origin: allowedOrigin }));
  app.use(bodyParser.json());

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

  const PORT = Number(process.env.MCP_HTTP_PORT || 3000);
  const listener = app.listen(PORT, () => {
    const addr = listener.address();
    const actualPort = typeof addr === 'object' && addr ? addr.port : PORT;
    console.log(`[MCP] HTTP listening on :${actualPort}`);
  });
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
