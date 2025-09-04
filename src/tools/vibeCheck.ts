import { getMetacognitiveQuestions } from '../utils/llm.js';
import { addToHistory, getHistorySummary } from '../utils/state.js';

// Vibe Check tool handler
export interface VibeCheckInput {
  goal: string;
  plan: string;
  modelOverride?: {
    provider?: string;
    model?: string;
  };
  userPrompt?: string;
  progress?: string;
  uncertainties?: string[];
  taskContext?: string;
  sessionId?: string;
}

export interface VibeCheckOutput {
  questions: string;
}

/**
 * Adaptive CPI interrupt for AI agent alignment and reflection.
 * Monitors progress and questions assumptions to mitigate Reasoning Lock-In.
 * The userRequest parameter MUST contain the full original request for safety.
 */
export async function vibeCheckTool(input: VibeCheckInput): Promise<VibeCheckOutput> {
  console.log('[vibe_check] called', { hasSession: Boolean(input.sessionId) });
  try {
    // Get history summary
    const historySummary = getHistorySummary(input.sessionId);

    // Get metacognitive questions from Gemini with dynamic parameters
    const response = await getMetacognitiveQuestions({
      goal: input.goal,
      plan: input.plan,
      modelOverride: input.modelOverride,
      userPrompt: input.userPrompt,
      progress: input.progress,
      uncertainties: input.uncertainties,
      taskContext: input.taskContext,
      sessionId: input.sessionId,
      historySummary,
    });

    // Add to history
    addToHistory(input.sessionId, input, response.questions);

    return {
      questions: response.questions,
    };
  } catch (error) {
    console.error('Error in vibe_check tool:', error);

    // Fallback to basic questions if there's an error
    return {
      questions: generateFallbackQuestions(input.userPrompt || "", input.plan || ""),
    };
  }
}

/**
 * Generate adaptive fallback questions when API fails
 */
function generateFallbackQuestions(userRequest: string, plan: string): string {
    return `
I can see you're thinking through your approach, which shows thoughtfulness:

1. Does this plan directly address what the user requested, or might it be solving a different problem?
2. Is there a simpler approach that would meet the user's needs?
3. What unstated assumptions might be limiting the thinking here?
4. How does this align with the user's original intent?
`;
}