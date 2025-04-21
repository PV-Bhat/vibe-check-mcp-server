// src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ——— Your business logic imports ———
// (Assuming you have these utility modules in src/utils)
import { getMistakes } from "./utils/storage.js";
import { getMetacognitiveQuestions } from "./utils/gemini.js";
import { distillPlan } from "./utils/distill.js";
import { learnFromMistake } from "./utils/learn.js";

// ——— Server setup ———
const server = new McpServer({
  name: "vibe-check-mcp",
  version: "0.2.0"
});

// ——— 1) VIBE_CHECK TOOL ———
const vibeCheckInput = z.object({
  plan:           z.string(),
  userRequest:    z.string(),
  thinkingLog:    z.string().optional(),
  availableTools: z.array(z.string()).optional(),
  focusAreas:     z.array(z.string()).optional(),
  sessionId:      z.string().optional(),
  previousAdvice: z.string().optional(),
  phase:          z.enum(["planning","implementation","review"]).optional(),
  confidence:     z.number().optional()
});
type VibeCheckInput = z.infer<typeof vibeCheckInput>;

server.tool(
  "vibe_check",
  vibeCheckInput.shape,
  async (args) => {
    const input = vibeCheckInput.parse(args as unknown);
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("Missing GEMINI_API_KEY env var");
      }
      const mistakeHistory = getMistakes();
      const response = await getMetacognitiveQuestions({
        plan:           input.plan,
        userRequest:    input.userRequest,
        thinkingLog:    input.thinkingLog,
        availableTools: input.availableTools,
        focusAreas:     input.focusAreas,
        mistakeHistory,
        previousAdvice: input.previousAdvice,
        phase:          input.phase,
        confidence:     input.confidence
      });
      // response should match { questions: string; patternAlert?: string }
      const { questions, patternAlert } = response;
      const content = [{ type: "text", text: questions }];
      if (patternAlert) content.push({ type: "text", text: patternAlert });
      return { content };
    } catch (err) {
      console.error("vibe_check error:", err);
      // Fallback questions
      let fallback = `I can see you're thinking through your approach.`;
      if (input.phase === "implementation") {
        fallback = `
1. Could any parts of this implementation be simplified?
2. How does it align with your original request: "${input.userRequest}"?
3. Might there be future maintenance challenges?
`;
      } else if (input.phase === "review") {
        fallback = `
1. Does this solution fully address the request?
2. How usable and maintainable is it?
3. Can anything be simplified without losing functionality?
`;
      }
      return { content: [{ type: "text", text: fallback }] };
    }
  }
);

// ——— 2) VIBE_DISTILL TOOL ———
const vibeDistillInput = z.object({
  plan:        z.string(),
  userRequest: z.string(),
  sessionId:   z.string().optional()
});
type VibeDistillInput = z.infer<typeof vibeDistillInput>;

server.tool(
  "vibe_distill",
  vibeDistillInput.shape,
  async (args) => {
    const input = vibeDistillInput.parse(args as unknown);
    try {
      const summary = await distillPlan(input.plan, input.userRequest, input.sessionId);
      return { content: [{ type: "text", text: summary }] };
    } catch (err) {
      console.error("vibe_distill error:", err);
      return { content: [{ type: "text", text: "Sorry, I couldn’t distill that plan right now." }] };
    }
  }
);

// ——— 3) VIBE_LEARN TOOL ———
const vibeLearnInput = z.object({
  mistake:  z.string(),
  category: z.string(),
  solution: z.string(),
  sessionId: z.string().optional()
});
type VibeLearnInput = z.infer<typeof vibeLearnInput>;

server.tool(
  "vibe_learn",
  vibeLearnInput.shape,
  async (args) => {
    const input = vibeLearnInput.parse(args as unknown);
    try {
      const tips = await learnFromMistake(input.mistake, input.category, input.solution, input.sessionId);
      return { content: [{ type: "text", text: tips }] };
    } catch (err) {
      console.error("vibe_learn error:", err);
      return { content: [{ type: "text", text: "Sorry, I couldn’t learn from that mistake right now." }] };
    }
  }
);

// ——— START THE SERVER ———
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch(err => {
  console.error("Fatal error starting MCP server:", err);
  process.exit(1);
});
