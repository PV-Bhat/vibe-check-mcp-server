#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { instrumentServer } from '@shinzolabs/instrumentation-mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpError, ErrorCode, ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import { fileURLToPath } from 'url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';

import { vibeCheckTool, VibeCheckInput, VibeCheckOutput } from './tools/vibeCheck.js';
import { vibeLearnTool, VibeLearnInput, VibeLearnOutput } from './tools/vibeLearn.js';
import { updateConstitution, resetConstitution, getConstitution } from './tools/constitution.js';
import { STANDARD_CATEGORIES, LearningType } from './utils/storage.js';
import { loadHistory } from './utils/state.js';
import { getPackageVersion } from './utils/version.js';
import { applyJsonRpcCompatibility, wrapTransportForCompatibility } from './utils/jsonRpcCompat.js';
import { createRequestScopedTransport, RequestScopeStore } from './utils/httpTransportWrapper.js';

const IS_DISCOVERY = process.env.MCP_DISCOVERY_MODE === '1';
const USE_STDIO = process.env.MCP_TRANSPORT === 'stdio';

if (USE_STDIO) {
  console.log = (...args) => console.error(...args);
}

const SCRIPT_PATH = fileURLToPath(import.meta.url);

export const SUPPORTED_LLM_PROVIDERS = ['gemini', 'openai', 'openrouter', 'anthropic'] as const;

export interface LoggerLike {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

export interface HttpServerOptions {
  port?: number;
  corsOrigin?: string;
  transport?: StreamableHTTPServerTransport;
  server?: Server;
  attachSignalHandlers?: boolean;
  signals?: NodeJS.Signals[];
  logger?: LoggerLike;
}

export interface HttpServerInstance {
  app: express.Express;
  listener: HttpServer;
  transport: StreamableHTTPServerTransport;
  close: () => Promise<void>;
}

export interface MainOptions {
  createServer?: () => Promise<Server>;
  startHttp?: (options: HttpServerOptions) => Promise<HttpServerInstance>;
}

type ToolHandler = (args: unknown) => Promise<{ content: any[] }> | { content: any[] };

interface InstrumentedToolRegistrar {
  tool: (name: string, ...rest: any[]) => { dispose: () => void };
}

export async function createMcpServer(): Promise<Server> {
  await loadHistory();

  const serverVersion = getPackageVersion();
  const server = new Server(
    { name: 'vibe-check', version: serverVersion },
    { capabilities: { tools: {}, sampling: {} } }
  );

  const toolHandlers = new Map<string, ToolHandler>();

  const instrumentationFacade: InstrumentedToolRegistrar = {
    tool: (name: string, ...rest: any[]) => {
      const handler = rest[rest.length - 1];
      if (typeof handler !== 'function') {
        throw new Error(`Tool handler for ${name} must be a function`);
      }
      toolHandlers.set(name, handler);
      return {
        dispose: () => {
          toolHandlers.delete(name);
        }
      };
    }
  };

  instrumentServer(instrumentationFacade as unknown as McpServer, {
    serverName: 'vibe-check',
    serverVersion,
    exporterEndpoint: 'https://api.app.shinzo.ai/telemetry/ingest_http',
    exporterAuth: {
      type: 'bearer',
      token: '2cc801222ab9c6576ff09be76d33af6e'
    }
  });

  instrumentationFacade.tool('vibe_check', async (input: VibeCheckInput) => {
    const result = await vibeCheckTool(input);
    return { content: [{ type: 'text', text: formatVibeCheckOutput(result) }] };
  });

  instrumentationFacade.tool('vibe_learn', async (input: VibeLearnInput) => {
    const result = await vibeLearnTool(input);
    return { content: [{ type: 'text', text: formatVibeLearnOutput(result) }] };
  });

  instrumentationFacade.tool('update_constitution', async (args: { sessionId: string; rule: string }) => {
    updateConstitution(args.sessionId, args.rule);
    console.log('[Constitution:update]', { sessionId: args.sessionId, count: getConstitution(args.sessionId).length });
    return { content: [{ type: 'text', text: '✅ Constitution updated' }] };
  });

  instrumentationFacade.tool('reset_constitution', async (args: { sessionId: string; rules: string[] }) => {
    resetConstitution(args.sessionId, args.rules);
    console.log('[Constitution:reset]', { sessionId: args.sessionId, count: getConstitution(args.sessionId).length });
    return { content: [{ type: 'text', text: '✅ Constitution reset' }] };
  });

  instrumentationFacade.tool('check_constitution', async (args: { sessionId: string }) => {
    const rules = getConstitution(args.sessionId);
    console.log('[Constitution:check]', { sessionId: args.sessionId, count: rules.length });
    return { content: [{ type: 'json', json: { rules } }] };
  });

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
                provider: { type: 'string', enum: [...SUPPORTED_LLM_PROVIDERS] },
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
    const handler = toolHandlers.get(name);
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    const args: any = raw;

    switch (name) {
      case 'vibe_check': {
        const missing: string[] = [];
        if (!args || typeof args.goal !== 'string') missing.push('goal');
        if (!args || typeof args.plan !== 'string') missing.push('plan');
        if (missing.length) {
          const example = '{"goal":"Ship CPI v2.5","plan":"1) tests 2) refactor 3) canary"}';
          const message = IS_DISCOVERY
            ? `discovery: missing [${missing.join(', ')}]; example: ${example}`
            : `Missing: ${missing.join(', ')}. Example: ${example}`;
          throw new McpError(ErrorCode.InvalidParams, message);
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
        return handler(input);
      }

      case 'vibe_learn': {
        const missing: string[] = [];
        if (!args || typeof args.mistake !== 'string') missing.push('mistake');
        if (!args || typeof args.category !== 'string') missing.push('category');
        if (missing.length) {
          const example = '{"mistake":"Skipped tests","category":"Feature Creep"}';
          const message = IS_DISCOVERY
            ? `discovery: missing [${missing.join(', ')}]; example: ${example}`
            : `Missing: ${missing.join(', ')}. Example: ${example}`;
          throw new McpError(ErrorCode.InvalidParams, message);
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
        return handler(input);
      }

      case 'update_constitution': {
        const missing: string[] = [];
        if (!args || typeof args.sessionId !== 'string') missing.push('sessionId');
        if (!args || typeof args.rule !== 'string') missing.push('rule');
        if (missing.length) {
          const example = '{"sessionId":"123","rule":"Always write tests first"}';
          const message = IS_DISCOVERY
            ? `discovery: missing [${missing.join(', ')}]; example: ${example}`
            : `Missing: ${missing.join(', ')}. Example: ${example}`;
          throw new McpError(ErrorCode.InvalidParams, message);
        }
        return handler({ sessionId: args.sessionId, rule: args.rule });
      }

      case 'reset_constitution': {
        const missing: string[] = [];
        if (!args || typeof args.sessionId !== 'string') missing.push('sessionId');
        if (!args || !Array.isArray(args.rules)) missing.push('rules');
        if (missing.length) {
          const example = '{"sessionId":"123","rules":["Be kind","Avoid loops"]}';
          const message = IS_DISCOVERY
            ? `discovery: missing [${missing.join(', ')}]; example: ${example}`
            : `Missing: ${missing.join(', ')}. Example: ${example}`;
          throw new McpError(ErrorCode.InvalidParams, message);
        }
        return handler({ sessionId: args.sessionId, rules: args.rules });
      }

      case 'check_constitution': {
        const missing: string[] = [];
        if (!args || typeof args.sessionId !== 'string') missing.push('sessionId');
        if (missing.length) {
          const example = '{"sessionId":"123"}';
          const message = IS_DISCOVERY
            ? `discovery: missing [${missing.join(', ')}]; example: ${example}`
            : `Missing: ${missing.join(', ')}. Example: ${example}`;
          throw new McpError(ErrorCode.InvalidParams, message);
        }
        return handler({ sessionId: args.sessionId });
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  });

  return server;
}

export async function startHttpServer(options: HttpServerOptions = {}): Promise<HttpServerInstance> {
  const logger = options.logger ?? console;
  const allowedOrigin = options.corsOrigin ?? process.env.CORS_ORIGIN ?? '*';
  const PORT = options.port ?? Number(process.env.MCP_HTTP_PORT || process.env.PORT || 3000);
  const server = options.server ?? (await createMcpServer());
  const requestScope = new AsyncLocalStorage<RequestScopeStore>();
  const baseTransport = options.transport ?? new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const transport = createRequestScopedTransport(baseTransport, requestScope);

  await server.connect(transport);

  const app = express();
  app.use(cors({ origin: allowedOrigin }));
  app.use(express.json());

  app.post('/mcp', async (req, res) => {
    const started = Date.now();
    const originalAcceptHeader = req.headers.accept;
    const rawAcceptValues = Array.isArray(originalAcceptHeader)
      ? originalAcceptHeader
      : [originalAcceptHeader ?? ''];
    const originalTokens: string[] = [];
    for (const rawValue of rawAcceptValues) {
      if (typeof rawValue !== 'string') continue;
      for (const token of rawValue.split(',')) {
        const trimmed = token.trim();
        if (trimmed) {
          originalTokens.push(trimmed);
        }
      }
    }
    const lowerTokens = originalTokens.map((value) => value.toLowerCase());
    const acceptsJson = lowerTokens.some((value) => value.includes('application/json'));
    const acceptsSse = lowerTokens.some((value) => value.includes('text/event-stream'));
    const normalizedTokens = new Set(originalTokens);
    if (!acceptsJson) {
      normalizedTokens.add('application/json');
    }
    if (!acceptsSse) {
      normalizedTokens.add('text/event-stream');
    }
    if (normalizedTokens.size === 0) {
      normalizedTokens.add('application/json');
      normalizedTokens.add('text/event-stream');
    }
    req.headers.accept = Array.from(normalizedTokens).join(', ');

    const forceJsonResponse = acceptsJson && !acceptsSse;

    const { applied, id: syntheticId } = applyJsonRpcCompatibility(req.body);
    const { id, method } = req.body ?? {};
    const sessionId = req.body?.params?.sessionId || req.body?.params?.arguments?.sessionId;
    logger.log('[MCP] request', { id, method, sessionId, syntheticId: applied ? syntheticId : undefined });
    try {
      await requestScope.run({ forceJson: forceJsonResponse }, async () => {
        await transport.handleRequest(req, res, req.body);
      });
    } catch (e: any) {
      logger.error('[MCP] error', { err: e?.message, id });
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', id: id ?? null, error: { code: -32603, message: 'Internal server error' } });
      }
    } finally {
      if (originalAcceptHeader === undefined) {
        delete req.headers.accept;
      } else {
        req.headers.accept = originalAcceptHeader;
      }
      logger.log('[MCP] handled', { id, ms: Date.now() - started });
    }
  });

  app.get('/mcp', (_req, res) => {
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
  });

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  const listener = app.listen(PORT, () => {
    const addr = listener.address() as AddressInfo | string | null;
    const actualPort = typeof addr === 'object' && addr ? addr.port : PORT;
    logger.log(`[MCP] HTTP listening on :${actualPort}`);
  });

  const signals = options.signals ?? ['SIGTERM', 'SIGINT'];
  const attachSignals = options.attachSignalHandlers ?? false;
  let signalHandler: (() => void) | null = null;

  const close = () =>
    new Promise<void>((resolve) => {
      listener.close(() => {
        if (attachSignals) {
          for (const signal of signals) {
            if (signalHandler) {
              process.off(signal, signalHandler);
            }
          }
        }
        resolve();
      });
    });

  if (attachSignals) {
    signalHandler = () => {
      close().then(() => process.exit(0));
    };
    for (const signal of signals) {
      process.on(signal, signalHandler);
    }
  }

  return { app, listener, transport, close };
}

export async function main(options: MainOptions = {}) {
  const createServerFn = options.createServer ?? createMcpServer;
  const startHttpFn = options.startHttp ?? startHttpServer;
  const server = await createServerFn();

  if (USE_STDIO) {
    const transport = wrapTransportForCompatibility(new StdioServerTransport());
    await server.connect(transport);
    console.error('[MCP] stdio transport connected');
  } else {
    await startHttpFn({ server, attachSignalHandlers: true, logger: console });
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

if (process.argv[1] === SCRIPT_PATH) {
  main().catch((error) => {
    console.error('Server startup error:', error);
    process.exit(1);
  });
}
