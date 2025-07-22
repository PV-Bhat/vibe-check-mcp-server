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
import { initializeGemini } from './utils/gemini.js';
import { STANDARD_CATEGORIES, LearningType } from './utils/storage.js';

import { loadHistory } from './utils/state.js';

// Validate API key at startup
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("ERROR: GEMINI_API_KEY environment variable is missing. Server cannot start without a valid API key.");
  process.exit(1);
} else {
  console.error("GEMINI_API_KEY found. Initializing API...");
  try {
    initializeGemini(apiKey);
    console.error('Gemini API initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Gemini API:', error);
    process.exit(1);
  }
}


/**
 * Start the server
 */
async function main() {
  await loadHistory();
  console.error('Starting Vibe Check MCP server...');

  const server = new Server(
    {
      name: "vibe-check",
      version: "0.2.0",
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
    
    // Add pattern alert section if present
    if (result.patternAlert) {
      // Check if the pattern alert is already in the response
      if (!output.includes("Pattern Alert:") && !output.includes("pattern emerging:")) {
        output += `\n\n**I notice a pattern emerging:** ${result.patternAlert}`;
      }
    }
    
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

  let buffer = '';
  process.stdin.on('data', async (data) => {
    buffer += data.toString();
    try {
      const request = JSON.parse(buffer);
      console.error('Received request:', request);

      if (request.method === 'tools/call' && request.params.name === 'vibe_check') {
        const result = await vibeCheckTool(request.params.arguments);
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [
              {
                type: 'text',
                text: formatVibeCheckOutput(result),
              },
            ],
          },
        };
        process.stdout.write(JSON.stringify(response));
      }
      buffer = ''; // Clear buffer after successful parse
    } catch (e) {
      // Incomplete JSON, wait for more data
    }
  });

  // Set up error handler
  server.onerror = (error) => {
    console.error("[Vibe Check Error]", error);
  };

  try {
    // Connect to transport
    console.error('Connecting to transport...');
    // const transport = new StdioServerTransport();
    // await server.connect(transport);

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