// src/index.ts
// @ts-ignore TS2307 / TS2724: Ignore likely incorrect compiler error for McpServer import based on examples.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z, ZodTypeAny } from "zod"; // Import ZodTypeAny if still needed, or just z

// Import Input/Output types from your tool files for handler args/return typing
import { vibeCheckTool, VibeCheckInput, VibeCheckOutput } from "./tools/vibeCheck.js";
import { vibeDistillTool, VibeDistillInput, VibeDistillOutput } from "./tools/vibeDistill.js";
import { vibeLearnTool, VibeLearnInput, VibeLearnOutput } from "./tools/vibeLearn.js";
import { MistakeEntry } from "./utils/storage.js";
import { initializeGemini } from "./utils/gemini.js";

console.error("MCP Server: Script starting...");

// --- Gemini Initialization ---
try { /* ... */ } catch (err: any) { /* ... */ }
// -----------------------------

// --- Zod Schemas (still needed for validation inside handlers) ---
const vibeCheckSchema = z.object({ /* ... schema definition ... */ }).required({ plan: true, userRequest: true });
const vibeDistillSchema = z.object({ /* ... schema definition ... */ }).required({ plan: true, userRequest: true });
const vibeLearnSchema = z.object({ /* ... schema definition ... */ }).required({ mistake: true, category: true, solution: true });
// ----------------------------------------------------------------

type CategorySummaryItem = { /* ... */ };

console.error("MCP Server: Creating McpServer instance...");
const server = new McpServer({
  name: "vibe-check-mcp",
  version: "0.2.0"
});
console.error("MCP Server: McpServer instance created.");

// --- Define Tools using server.tool(name, description, handler) ---

console.error("MCP Server: Defining 'vibe_check' tool...");
server.tool(
    "vibe_check",
    // Provide description string as second argument
    "Metacognitive check for plan alignment and assumption testing.",
    // Handler function - args will likely be 'any' or 'unknown', needs parsing
    async (args: any): Promise<{ content: { type: 'text', text: string }[] }> => {
        console.error(`MCP Server: Executing tool: vibe_check...`);
        try {
            // **MANUAL PARSING/VALIDATION NEEDED HERE**
            const validatedArgs: VibeCheckInput = vibeCheckSchema.parse(args ?? {}); // Use schema to parse/validate raw args
            const result: VibeCheckOutput = await vibeCheckTool(validatedArgs);
            console.error(`MCP Server: Tool vibe_check executed successfully.`);
            return { content: [{ type: "text", text: result.questions + (result.patternAlert ? `\n\n**Pattern Alert:** ${result.patternAlert}`: "") }] };
        } catch (error: any) {
             console.error(`[ERR] Error during vibe_check execution or validation:`, error);
             if (error instanceof z.ZodError) {
                 return { error: { code: "invalid_params", message: `Invalid arguments for vibe_check: ${error.errors.map(e=>e.message).join(', ')}` } };
             }
             return { error: { code: "tool_execution_error", message: `Error executing tool vibe_check: ${error.message}` } };
        }
    }
);
console.error("MCP Server: 'vibe_check' tool defined.");

console.error("MCP Server: Defining 'vibe_distill' tool...");
server.tool(
    "vibe_distill",
    // Provide description string as second argument
    "Distills a plan to its essential core.",
    // Handler function - args will likely be 'any' or 'unknown', needs parsing
    async (args: any): Promise<{ content: { type: 'markdown', markdown: string }[] }> => {
         console.error(`MCP Server: Executing tool: vibe_distill...`);
         try {
            // **MANUAL PARSING/VALIDATION NEEDED HERE**
            const validatedArgs: VibeDistillInput = vibeDistillSchema.parse(args ?? {}); // Use schema to parse/validate raw args
            const result: VibeDistillOutput = await vibeDistillTool(validatedArgs);
            console.error(`MCP Server: Tool vibe_distill executed successfully.`);
            return { content: [{ type: "markdown", markdown: result.distilledPlan + `\n\n**Rationale:** ${result.rationale}` }] };
         } catch (error: any) {
              console.error(`[ERR] Error during vibe_distill execution or validation:`, error);
              if (error instanceof z.ZodError) {
                  return { error: { code: "invalid_params", message: `Invalid arguments for vibe_distill: ${error.errors.map(e=>e.message).join(', ')}` } };
              }
              return { error: { code: "tool_execution_error", message: `Error executing tool vibe_distill: ${error.message}` } };
         }
    }
);
console.error("MCP Server: 'vibe_distill' tool defined.");

console.error("MCP Server: Defining 'vibe_learn' tool...");
server.tool(
    "vibe_learn",
    // Provide description string as second argument
    "Logs mistake patterns for future improvement.",
    // Handler function - args will likely be 'any' or 'unknown', needs parsing
    async (args: any): Promise<{ content: { type: 'text', text: string }[] }> => {
        console.error(`MCP Server: Executing tool: vibe_learn...`);
         try {
            // **MANUAL PARSING/VALIDATION NEEDED HERE**
            const validatedArgs: VibeLearnInput = vibeLearnSchema.parse(args ?? {}); // Use schema to parse/validate raw args
            const result: VibeLearnOutput = await vibeLearnTool(validatedArgs);
            console.error(`MCP Server: Tool vibe_learn executed successfully.`);
            const summary = result.topCategories.map((cat: CategorySummaryItem) => `- ${cat.category} (${cat.count})`).join('\n');
            return { content: [{ type: "text", text: `✅ Pattern logged. Tally for category: ${result.currentTally}.\nTop Categories:\n${summary}` }] };
         } catch (error: any) {
              console.error(`[ERR] Error during vibe_learn execution or validation:`, error);
              if (error instanceof z.ZodError) {
                  return { error: { code: "invalid_params", message: `Invalid arguments for vibe_learn: ${error.errors.map(e=>e.message).join(', ')}` } };
              }
              return { error: { code: "tool_execution_error", message: `Error executing tool vibe_learn: ${error.message}` } };
         }
    }
);
console.error("MCP Server: 'vibe_learn' tool defined.");

// Create the transport instance
console.error("MCP Server: Creating StdioServerTransport...");
const transport = new StdioServerTransport();
console.error("MCP Server: StdioServerTransport created.");

// Connect the server and transport
console.error("MCP Server: Connecting server to transport...");
(async () => {
    try {
        await server.connect(transport);
        console.error("MCP Server: Server connected to transport. Ready for messages.");
    } catch (error) {
        console.error("MCP Server: Error connecting server to transport:", error);
        process.exit(1);
    }
})();

// Assign callback to 'onclose' property
if (typeof transport.onclose === 'function' || typeof transport.onclose === 'undefined') {
    transport.onclose = () => {
        console.error("MCP Server: Transport closed event received.");
    };
} else {
     console.error("MCP Server: transport.onclose property not found or not assignable.");
}
