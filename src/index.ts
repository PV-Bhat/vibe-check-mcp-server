// src/index.ts
// @ts-ignore TS2724 / TS2307: Ignore likely incorrect compiler error for McpServer import due to faulty SDK types. Examples show this path is correct.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// Import request types if needed, e.g., for capabilities, not strictly needed for server.tool handlers
// import { CallToolRequest } from "@modelcontextprotocol/sdk/types.js";

// Import Input/Output types from your tool files for handler args/return typing
import { vibeCheckTool, VibeCheckInput, VibeCheckOutput } from "./tools/vibeCheck.js";
import { vibeDistillTool, VibeDistillInput, VibeDistillOutput } from "./tools/vibeDistill.js";
import { vibeLearnTool, VibeLearnInput, VibeLearnOutput } from "./tools/vibeLearn.js";
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

// Type helper for learn tool summary
type CategorySummaryItem = {
  category: string;
  count: number;
  recentExample: MistakeEntry;
};

console.error("MCP Server: Creating McpServer instance...");
// Use McpServer based on examples, ignore potential TS error on import line above
const server = new McpServer({
  name: "vibe-check-mcp",
  version: "0.2.0"
});
console.error("MCP Server: McpServer instance created.");

// --- Define Tools using server.tool() ---

console.error("MCP Server: Defining 'vibe_check' tool...");
server.tool(
    "vibe_check",
    // Zod schema mirroring VibeCheckInput
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
    }).required({
        plan: true,
        userRequest: true
    }),
    // Handler function with explicit args type
    async (args: VibeCheckInput): Promise<{ content: { type: 'text', text: string }[] }> => {
        console.error(`MCP Server: Executing tool: vibe_check...`);
        const result: VibeCheckOutput = await vibeCheckTool(args);
        console.error(`MCP Server: Tool vibe_check executed successfully.`);
        return { content: [{ type: "text", text: result.questions + (result.patternAlert ? `\n\n**Pattern Alert:** ${result.patternAlert}`: "") }] };
    }
);
console.error("MCP Server: 'vibe_check' tool defined.");

console.error("MCP Server: Defining 'vibe_distill' tool...");
server.tool(
    "vibe_distill",
    // Zod schema mirroring VibeDistillInput
    z.object({
        plan: z.string(),
        userRequest: z.string(),
        sessionId: z.string().optional()
    }).required({
        plan: true,
        userRequest: true
    }),
    // Handler function with explicit args type
    async (args: VibeDistillInput): Promise<{ content: { type: 'markdown', markdown: string }[] }> => {
        console.error(`MCP Server: Executing tool: vibe_distill...`);
        const result: VibeDistillOutput = await vibeDistillTool(args);
        console.error(`MCP Server: Tool vibe_distill executed successfully.`);
        return { content: [{ type: "markdown", markdown: result.distilledPlan + `\n\n**Rationale:** ${result.rationale}` }] };
    }
);
console.error("MCP Server: 'vibe_distill' tool defined.");

console.error("MCP Server: Defining 'vibe_learn' tool...");
server.tool(
    "vibe_learn",
    // Zod schema mirroring VibeLearnInput
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
    // Handler function with explicit args type
    async (args: VibeLearnInput): Promise<{ content: { type: 'text', text: string }[] }> => {
        console.error(`MCP Server: Executing tool: vibe_learn...`);
        const result: VibeLearnOutput = await vibeLearnTool(args);
        console.error(`MCP Server: Tool vibe_learn executed successfully.`);
        const summary = result.topCategories.map((cat: CategorySummaryItem) => `- ${cat.category} (${cat.count})`).join('\n');
        return { content: [{ type: "text", text: `✅ Pattern logged. Tally for category: ${result.currentTally}.\nTop Categories:\n${summary}` }] };
    }
);
console.error("MCP Server: 'vibe_learn' tool defined.");

// Create the transport instance
console.error("MCP Server: Creating StdioServerTransport...");
const transport = new StdioServerTransport();
console.error("MCP Server: StdioServerTransport created.");

// Connect the server and transport
console.error("MCP Server: Connecting server to transport...");
// Wrap connect in an async IIFE (Immediately Invoked Function Expression) as connect is async
(async () => {
    try {
        await server.connect(transport);
        console.error("MCP Server: Server connected to transport. Ready for messages.");
    } catch (error) {
        console.error("MCP Server: Error connecting server to transport:", error);
        process.exit(1); // Exit if connection fails
    }
})();


// Assign callback to 'onclose' property
if (transport.onclose) {
    transport.onclose = () => {
        console.error("MCP Server: Transport closed event received.");
        // Optionally exit the process when the transport closes
        // process.exit(0);
    };
} else {
     console.error("MCP Server: transport.onclose property not found.");
}

// Keep process alive until transport closes (or handle signals)
// process.stdin.resume(); // Keep Node running, uncomment if needed but check SDK behavior first
