#!/usr/bin/env node

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
import { vibeDistillTool, VibeDistillInput, VibeDistillOutput } from './tools/vibeDistill.js';
import { vibeLearnTool, VibeLearnInput, VibeLearnOutput } from './tools/vibeLearn.js';

// Import Gemini integration
import { initializeGemini } from './utils/gemini.js';
import { STANDARD_CATEGORIES } from './utils/storage.js';

/**
 * Create the MCP server with appropriate capabilities
 */
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

/**
 * Handler for listing available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "vibe_check",
        description: "Metacognitive questioning tool that identifies assumptions and breaks tunnel vision to prevent cascading errors",
        inputSchema: {
          type: "object",
          properties: {
            plan: {
              type: "string",
              description: "Current plan or thinking"
            },
            userRequest: {
              type: "string",
              description: "Original user request - critical for alignment checking"
            },
            thinkingLog: {
              type: "string",
              description: "Raw sequential thinking transcript"
            },
            availableTools: {
              type: "array",
              items: {
                type: "string"
              },
              description: "List of available MCP tools"
            },
            focusAreas: {
              type: "array",
              items: {
                type: "string"
              },
              description: "Optional specific focus areas"
            },
            sessionId: {
              type: "string",
              description: "Optional session ID for state management"
            },
            previousAdvice: {
              type: "string",
              description: "Previous feedback to avoid repetition and ensure progression"
            },
            phase: {
              type: "string",
              enum: ["planning", "implementation", "review"],
              description: "Current project phase for context-appropriate feedback"
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
              description: "Agent's confidence level (0-1)"
            }
          },
          required: ["plan", "userRequest"] // userRequest now required
        }
      },
      {
        name: "vibe_distill",
        description: "Plan simplification tool that reduces complexity and extracts essential elements to prevent over-engineering",
        inputSchema: {
          type: "object",
          properties: {
            plan: {
              type: "string",
              description: "The plan to distill"
            },
            userRequest: {
              type: "string",
              description: "Original user request"
            },
            sessionId: {
              type: "string",
              description: "Optional session ID for state management"
            }
          },
          required: ["plan", "userRequest"] // userRequest now required
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
              description: "One-sentence description of the mistake"
            },
            category: {
              type: "string",
              description: `Category of mistake (standard categories: ${STANDARD_CATEGORIES.join(', ')})`,
              enum: STANDARD_CATEGORIES
            },
            solution: {
              type: "string",
              description: "How it was corrected (one sentence)"
            },
            sessionId: {
              type: "string",
              description: "Optional session ID for state management"
            }
          },
          required: ["mistake", "category", "solution"]
        }
      }
    ]
  };
});

/**
 * Handler for tool invocation
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case "vibe_check": {
      // Validate required userRequest
      if (!args || !args.userRequest || typeof args.userRequest !== 'string' || args.userRequest.trim() === '') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'FULL user request is required for alignment checking and to prevent bias'
        );
      }
      
      // Fix type casting error - convert args to the correct interface
      const input: VibeCheckInput = {
        plan: typeof args.plan === 'string' ? args.plan : '',
        userRequest: args.userRequest,
        thinkingLog: typeof args.thinkingLog === 'string' ? args.thinkingLog : undefined,
        availableTools: Array.isArray(args.availableTools) ? args.availableTools : undefined,
        focusAreas: Array.isArray(args.focusAreas) ? args.focusAreas : undefined,
        sessionId: typeof args.sessionId === 'string' ? args.sessionId : undefined,
        previousAdvice: typeof args.previousAdvice === 'string' ? args.previousAdvice : undefined,
        phase: ['planning', 'implementation', 'review'].includes(args.phase as string) ? 
          args.phase as 'planning' | 'implementation' | 'review' : undefined,
        confidence: typeof args.confidence === 'number' ? args.confidence : undefined
      };
      
      const result = await vibeCheckTool(input);
      
      return {
        content: [
          {
            type: "text",
            text: formatVibeCheckOutput(result)
          }
        ]
      };
    }
    
    case "vibe_distill": {
      // Validate required parameters
      if (!args || typeof args.plan !== 'string') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid input: plan is required and must be a string'
        );
      }
      
      // Validate required userRequest
      if (!args.userRequest || typeof args.userRequest !== 'string' || args.userRequest.trim() === '') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'FULL user request is required for proper distillation and alignment'
        );
      }
      
      // Create a properly typed input
      const input: VibeDistillInput = {
        plan: args.plan,
        userRequest: args.userRequest,
        sessionId: typeof args.sessionId === 'string' ? args.sessionId : undefined
      };
      
      const result = await vibeDistillTool(input);
      
      return {
        content: [
          {
            type: "text",
            text: result.distilledPlan
          }
        ]
      };
    }
    
    case "vibe_learn": {
      if (!args || 
          typeof args.mistake !== 'string' || 
          typeof args.category !== 'string' || 
          typeof args.solution !== 'string') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid input: mistake, category, and solution are required and must be strings'
        );
      }
      
      // Create a properly typed input
      const input: VibeLearnInput = {
        mistake: args.mistake,
        category: args.category,
        solution: args.solution,
        sessionId: typeof args.sessionId === 'string' ? args.sessionId : undefined
      };
      
      const result = await vibeLearnTool(input);
      
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
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${name}`
      );
  }
});

/**
 * Format vibe check output as markdown
 */
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

/**
 * Format vibe learn output as markdown
 */
function formatVibeLearnOutput(result: VibeLearnOutput): string {
  let output = '';
  
  if (result.added) {
    output += `✅ Pattern logged successfully (category tally: ${result.currentTally})`;
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

/**
 * Start the server
 */
async function main() {
  console.error('Starting Vibe Check MCP server...');
  
  // Initialize Gemini API with environment variable
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      initializeGemini(apiKey);
      console.error('Gemini API initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Gemini API:', error);
    }
  } else {
    console.error('Warning: GEMINI_API_KEY environment variable not set. Metacognitive questioning functionality will be limited.');
  }
  
  // Set up error handler
  server.onerror = (error) => {
    console.error("[Vibe Check Error]", error);
  };
  
  // Connect to transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('Vibe Check MCP server running');
}

// Start the server
main().catch((error) => {
  console.error("Server startup error:", error);
  process.exit(1);
});