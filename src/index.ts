#!/usr/bin/env node

// Import dotenv and configure it
import dotenv from 'dotenv';
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// Import tool implementations
import { vibeCheckTool, VibeCheckInput, VibeCheckOutput } from './tools/vibeCheck.js';
import { vibeLearnTool, VibeLearnInput, VibeLearnOutput } from './tools/vibeLearn.js';

// Import Gemini integration
import { STANDARD_CATEGORIES, LearningType } from './utils/storage.js';

import { loadHistory } from './utils/state.js';




/**
 * Start the server
 */
async function main() {
  await loadHistory();
  console.error('Starting Vibe Check MCP server...');

  const server = new Server(
    {
      name: "vibe-check",
      version: "2.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error("Received tools/list request");
    const response = {
      tools: [
        {
          name: "vibe_check",
          description: "Metacognitive questioning tool that identifies assumptions and breaks tunnel vision to prevent cascading errors",
          inputSchema: {
            type: "object",
            properties: {
              goal: {
                type: "string",
                description: "The agent's current goal"
              },
              plan: {
                type: "string",
                description: "The agent's detailed plan"
              },
              modelOverride: {
                type: "object",
                properties: {
                  provider: {
                    type: "string",
                    enum: ["gemini", "openai", "openrouter"]
                  },
                  model: {
                    type: "string"
                  }
                },
                required: []
              },
              userPrompt: {
                type: "string",
                description: "The original user prompt"
              },
              progress: {
                type: "string",
                description: "The agent's progress so far"
              },
              uncertainties: {
                type: "array",
                items: {
                  type: "string"
                },
                description: "The agent's uncertainties"
              },
              taskContext: {
                type: "string",
                description: "The context of the current task"
              },
              sessionId: {
                type: "string",
                description: "Optional session ID for state management"
              }
            },
            required: ["goal", "plan"]
          }
        },
        {
          name: "vibe_learn",
          description: "Pattern recognition system that tracks common errors and solutions to prevent recurring issues",
          inputSchema: {
            type: "object",
            properties: {
              mistake: {
                type: "string",
                description: "One-sentence description of the learning entry"
              },
              category: {
                type: "string",
                description: `Category (standard categories: ${STANDARD_CATEGORIES.join(', ')})`,
                enum: STANDARD_CATEGORIES
              },
              solution: {
                type: "string",
                description: "How it was corrected (if applicable)"
              },
              type: {
                type: "string",
                enum: ["mistake", "preference", "success"],
                description: "Type of learning entry"
              },
              sessionId: {
                type: "string",
                description: "Optional session ID for state management"
              }
            },
            required: ["mistake", "category"]
          }
        }
      ]
    };
    console.error(`Responding with ${response.tools.length} tools`);
    return response;
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    console.error(`Received tools/call request for tool: ${request.params.name}`);
    
    const { name, arguments: args } = request.params;
    
    switch (name) {
      case "vibe_check": {
        // Validate required goal and plan
        if (!args || typeof args.goal !== 'string' || typeof args.plan !== 'string') {
          console.error("Invalid vibe_check request: missing goal or plan");
          throw new McpError(
            ErrorCode.InvalidParams,
            'goal and plan are required for alignment checking and to prevent bias'
          );
        }

        // Determine provider for lazy auth validation
        const provider = (args as any)?.modelOverride?.provider || process.env.DEFAULT_LLM_PROVIDER || 'gemini';
        if (provider === 'gemini' && !process.env.GEMINI_API_KEY) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing GEMINI_API_KEY');
        }
        if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing OPENAI_API_KEY');
        }
        if (provider === 'openrouter' && !process.env.OPENROUTER_API_KEY) {
          throw new McpError(ErrorCode.InvalidParams, 'Missing OPENROUTER_API_KEY');
        }

        // Fix type casting error - convert args to the correct interface
        const input: VibeCheckInput = {
          goal: args.goal,
          plan: args.plan,
          modelOverride: args.modelOverride as any,
          userPrompt: typeof args.userPrompt === 'string' ? args.userPrompt : undefined,
          progress: typeof args.progress === 'string' ? args.progress : undefined,
          uncertainties: Array.isArray(args.uncertainties) ? args.uncertainties : undefined,
          taskContext: typeof args.taskContext === 'string' ? args.taskContext : undefined,
          sessionId: typeof args.sessionId === 'string' ? args.sessionId : undefined,
        };

        console.error("Executing vibe_check tool...");
        const result = await vibeCheckTool(input);
        console.error("vibe_check execution complete");

        return {
          content: [
            {
              type: "text",
              text: formatVibeCheckOutput(result),
            },
          ],
        };
      }
      
      
      case "vibe_learn": {
        if (!args || typeof args.mistake !== 'string' || typeof args.category !== 'string') {
          console.error("Invalid vibe_learn request: missing required parameters");
          throw new McpError(
            ErrorCode.InvalidParams,
            'Invalid input: mistake and category are required and must be strings'
          );
        }
        
        // Create a properly typed input
        const input: VibeLearnInput = {
          mistake: args.mistake,
          category: args.category,
          solution: typeof args.solution === 'string' ? args.solution : undefined,
          type: ['mistake', 'preference', 'success'].includes(args.type as string)
            ? (args.type as LearningType)
            : undefined,
          sessionId: typeof args.sessionId === 'string' ? args.sessionId : undefined
        };
        
        console.error("Executing vibe_learn tool...");
        const result = await vibeLearnTool(input);
        console.error("vibe_learn execution complete");
        
        return {
          content: [
            {
              type: "text",
              text: formatVibeLearnOutput(result)
            }
          ]
        };
      }
      
      default:
        console.error(`Unknown tool requested: ${name}`);
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  });

  function formatVibeCheckOutput(result: VibeCheckOutput): string {
    let output = result.questions;
    
    return output;
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
    
    // Add top categories section
    if (result.topCategories && result.topCategories.length > 0) {
      output += '\n\n## Top Pattern Categories\n';
      for (const category of result.topCategories) {
        output += `\n### ${category.category} (${category.count} occurrences)\n`;
        
        // Show the most recent example
        if (category.recentExample) {
          output += `Most recent: "${category.recentExample.mistake}"\n`;
          output += `Solution: "${category.recentExample.solution}"\n`;
        }
      }
    }
    
    return output;
  }

  // Set up error handler
  server.onerror = (error) => {
    console.error("[Vibe Check Error]", error);
  };

  try {
    console.error('Connecting to transport...');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Vibe Check MCP server running');
  } catch (error) {
    console.error("Error connecting to transport:", error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error("Server startup error:", error);
  process.exit(1);
});
