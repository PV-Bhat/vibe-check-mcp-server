// src/index.ts
// Try importing McpServer from server/index.js again, now using .tool()
import { McpServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// Import Zod for defining input schemas with server.tool()
import { z } from "zod";
// Import specific request types if needed for handlers, otherwise handler args are inferred
import { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";

import { vibeCheckTool, VibeCheckInput } from "./tools/vibeCheck.js"; // Assuming VibeCheckInput is exported
import { vibeDistillTool, VibeDistillInput } from "./tools/vibeDistill.js"; // Assuming VibeDistillInput is exported
import { vibeLearnTool, VibeLearnInput, VibeLearnOutput } from "./tools/vibeLearn.js"; // Assuming VibeLearnInput is exported
import { MistakeEntry } from "./utils/storage.js";
import { initializeGemini } from "./utils/gemini.js";

console.error("MCP Server: Script starting...");

// --- Explicitly Initialize Gemini ---
try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("MCP Server: WARNING - GEMINI_API_KEY environment variable not found!");
    } else {
        initializeGemini(apiKey);
        console.error("MCP Server: Gemini client potentially initialized.");
    }
} catch (err: any) {
    console.error("MCP Server: ERROR initializing Gemini client -", err);
}
// ------------------------------------

type CategorySummaryItem = {
  category: string;
  count: number;
  recentExample: MistakeEntry;
};

console.error("MCP Server: Creating McpServer instance...");
// Use McpServer class again
const server = new McpServer({
  name: "vibe-check-mcp",
  version: "0.2.0"
});
console.error("MCP Server: McpServer instance created.");

// --- Define Tools using server.tool() ---

console.error("MCP Server: Defining 'vibe_check' tool...");
server.tool(
    "vibe_check",
    // Define input schema using Zod
    z.object({
        plan: z.string(),
        userRequest: z.string(),
        thinkingLog: z.string().optional(),
        availableTools: z.array(z.string()).optional(),
        focusAreas: z.array(z.string()).optional(),
        sessionId: z.string().optional(),
        previousAdvice: z.string().optional(),
        phase: z.enum(["planning", "implementation", "review"]).optional(),
        confidence: z.number().optional()
    }).required({ // Explicitly state required fields matching your TS interface
        plan: true,
        userRequest: true
    }),
    // Handler function - arguments are automatically typed based on schema
    async (args) => {
        console.error(`MCP Server: Executing tool: vibe_check...`);
        // Args type should match VibeCheckInput here due to Zod schema
        const result = await vibeCheckTool(args);
        console.error(`MCP Server: Tool vibe_check executed successfully.`);
        // Return result formatted as MCP content
        return { content: [{ type: "text", text: result.questions + (result.patternAlert ? `\n\n**Pattern Alert:** ${result.patternAlert}`: "") }] };
    }
);
console.error("MCP Server: 'vibe_check' tool defined.");

console.error("MCP Server: Defining 'vibe_distill' tool...");
server.tool(
    "vibe_distill",
    z.object({
        plan: z.string(),
        userRequest: z.string(),
        sessionId: z.string().optional()
    }).required({
        plan: true,
        userRequest: true
    }),
    async (args) => {
        console.error(`MCP Server: Executing tool: vibe_distill...`);
        const result = await vibeDistillTool(args);
         console.error(`MCP Server: Tool vibe_distill executed successfully.`);
        return { content: [{ type: "markdown", markdown: result.distilledPlan + `\n\n**Rationale:** ${result.rationale}` }] };
    }
);
console.error("MCP Server: 'vibe_distill' tool defined.");

console.error("MCP Server: Defining 'vibe_learn' tool...");
server.tool(
    "vibe_learn",
     z.object({
        mistake: z.string(),
        category: z.string(),
        solution: z.string(),
        sessionId: z.string().optional()
    }).required({
        mistake: true,
        category: true,
        solution: true
    }),
    async (args) => {
        console.error(`MCP Server: Executing tool: vibe_learn...`);
        const result = await vibeLearnTool(args) as VibeLearnOutput; // Cast needed if return type isn't perfectly inferred
        console.error(`MCP Server: Tool vibe_learn executed successfully.`);
        const summary = result.topCategories.map((cat: CategorySummaryItem) => `- ${cat.category} (${cat.count})`).join('\n');
        return { content: [{ type: "text", text: `✅ Pattern logged. Tally for category: ${result.currentTally}.\nTop Categories:\n${summary}` }] };
    }
);
console.error("MCP Server: 'vibe_learn' tool defined.");

// --- Remove setRequestHandler calls for ListTools and CallTool ---
// The server.tool() calls handle registration implicitly.

// --- Remove explicit Initialize handler ---
// SDK likely handles this when tools are defined via server.tool()

// Create the transport instance
console.error("MCP Server: Creating StdioServerTransport...");
const transport = new StdioServerTransport();
console.error("MCP Server: StdioServerTransport created.");

// Connect the server and transport
console.error("MCP Server: Connecting server to transport...");
server.connect(transport); // Use server.connect() as before
console.error("MCP Server: Server connected to transport. Ready for messages.");

// Assign callback to 'onclose' property
if (transport.onclose) {
    transport.onclose = () => {
        console.error("MCP Server: Transport closed event received.");
    };
} else {
     console.error("MCP Server: transport.onclose property not found.");
}
